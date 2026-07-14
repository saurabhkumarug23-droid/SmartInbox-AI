import type { EmailMessage, SyncResponse, SyncUpdatedResponse } from '@/lib/types';
import pLimit from 'p-limit';
import { db } from '@/server/db';
import { syncEmailsToDatabase } from './sync-to-db';
import {
    buildRfc2822Message,
    encodeBase64Url,
    getAuthenticatedGmailClient,
    getStoredHistoryId,
    mapGmailMessageToEmailMessage,
    storeHistoryId,
} from './gmail-utils';

class Account {
    private token: string;
    private daysWithin = 3;

    constructor(token: string) {
        this.token = token;
    }

    private async getGmailClient() {
        const { gmail, account } = await getAuthenticatedGmailClient(this.token)
        this.token = account.accessToken
        return { gmail, account }
    }

    private async fetchMessagesByIds(gmail: Awaited<ReturnType<typeof getAuthenticatedGmailClient>>['gmail'], messageIds: string[]): Promise<EmailMessage[]> {
        const limit = pLimit(10);
        
        const fetchPromises = messageIds.map(messageId => 
            limit(async () => {
                try {
                    const { data } = await gmail.users.messages.get({
                        userId: 'me',
                        id: messageId,
                        format: 'full',
                    })
                    return mapGmailMessageToEmailMessage(data)
                } catch (error) {
                    console.error(`Failed to fetch Gmail message ${messageId}:`, error)
                    return null;
                }
            })
        );
        
        const results = await Promise.all(fetchPromises);
        return results.filter((msg): msg is EmailMessage => msg !== null);
    }

    private async getCurrentHistoryId(gmail: Awaited<ReturnType<typeof getAuthenticatedGmailClient>>['gmail']) {
        const { data: profile } = await gmail.users.getProfile({ userId: 'me' })
        return profile.historyId ?? '0'
    }

    private async startSync(daysWithin: number): Promise<SyncResponse> {
        this.daysWithin = daysWithin
        const { gmail } = await this.getGmailClient()
        const historyId = await this.getCurrentHistoryId(gmail)

        return {
            syncUpdatedToken: historyId,
            syncDeletedToken: historyId,
            ready: true,
        }
    }

    async createSubscription() {
        const topicName = process.env.GOOGLE_PUBSUB_TOPIC
        if (!topicName) {
            console.warn('GOOGLE_PUBSUB_TOPIC is not configured; skipping Gmail watch setup')
            return {}
        }

        const { gmail, account } = await this.getGmailClient()
        const response = await gmail.users.watch({
            userId: 'me',
            requestBody: {
                topicName,
                labelIds: ['INBOX'],
            },
        })

        if (response.data.historyId) {
            await storeHistoryId(account.id, response.data.historyId)
        }

        return response.data
    }

    async syncEmails() {
        const account = await db.account.findUnique({
            where: {
                accessToken: this.token,
            },
        })
        if (!account) throw new Error("Invalid token")

        const historyId = getStoredHistoryId(account.binaryIndex)
        let response = await this.getUpdatedEmails(historyId ? { deltaToken: historyId } : {})
        let allEmails: EmailMessage[] = response.records

        while (response.nextPageToken) {
            response = await this.getUpdatedEmails({
                deltaToken: historyId,
                pageToken: response.nextPageToken,
            })
            allEmails = allEmails.concat(response.records)
        }

        if (!response) throw new Error("Failed to sync emails")

        try {
            await syncEmailsToDatabase(allEmails, account.id)
        } catch (error) {
            console.log('error', error)
        }

        await storeHistoryId(account.id, response.nextDeltaToken)
    }

    async getUpdatedEmails({ deltaToken, pageToken }: { deltaToken?: string, pageToken?: string }): Promise<SyncUpdatedResponse> {
        const { gmail } = await this.getGmailClient()

        if (deltaToken && deltaToken !== '0') {
            const historyResponse = await gmail.users.history.list({
                userId: 'me',
                startHistoryId: deltaToken,
                pageToken,
                historyTypes: ['messageAdded'],
            })

            const messageIds = new Set<string>()
            for (const record of historyResponse.data.history ?? []) {
                for (const added of record.messagesAdded ?? []) {
                    if (added.message?.id) {
                        messageIds.add(added.message.id)
                    }
                }
            }

            const records = await this.fetchMessagesByIds(gmail, [...messageIds])
            const nextDeltaToken = await this.getCurrentHistoryId(gmail)

            return {
                records,
                nextPageToken: historyResponse.data.nextPageToken ?? undefined,
                nextDeltaToken,
            }
        }

        const listResponse = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 100,
            pageToken,
            q: `newer_than:${this.daysWithin}d`,
        })

        const messageIds = listResponse.data.messages?.map((message) => message.id!).filter(Boolean) ?? []
        const records = await this.fetchMessagesByIds(gmail, messageIds)
        const nextDeltaToken = await this.getCurrentHistoryId(gmail)

        return {
            records,
            nextPageToken: listResponse.data.nextPageToken ?? undefined,
            nextDeltaToken,
        }
    }

    async performInitialSync() {
        try {
            const daysWithin = 3
            const syncResponse = await this.startSync(daysWithin)

            let storedDeltaToken: string = syncResponse.syncUpdatedToken
            // Fetch the initial batch of emails (last 3 days) without a delta token
            let updatedResponse = await this.getUpdatedEmails({})
            let allEmails: EmailMessage[] = updatedResponse.records

            while (updatedResponse.nextPageToken) {
                updatedResponse = await this.getUpdatedEmails({
                    pageToken: updatedResponse.nextPageToken,
                })
                allEmails = allEmails.concat(updatedResponse.records)
                if (updatedResponse.nextDeltaToken) {
                    storedDeltaToken = updatedResponse.nextDeltaToken
                }
            }

            const account = await db.account.findUnique({
                where: { accessToken: this.token },
                select: { id: true },
            })

            if (account) {
                await storeHistoryId(account.id, storedDeltaToken)
            }

            return {
                emails: allEmails,
                deltaToken: storedDeltaToken,
            }
        } catch (error) {
            console.error('Error during sync:', error)
        }
    }

    async sendEmail({
        from,
        subject,
        body,
        inReplyTo,
        references,
        threadId,
        to,
        cc,
        bcc,
        replyTo,
    }: {
        from: EmailAddress;
        subject: string;
        body: string;
        inReplyTo?: string;
        references?: string;
        threadId?: string;
        to: EmailAddress[];
        cc?: EmailAddress[];
        bcc?: EmailAddress[];
        replyTo?: EmailAddress;
    }) {
        try {
            const { gmail } = await this.getGmailClient()

            const rawMessage = buildRfc2822Message({
                from,
                subject,
                body,
                inReplyTo,
                references,
                to,
                cc,
                bcc,
                replyTo,
            })

            const response = await gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: encodeBase64Url(rawMessage),
                    threadId,
                },
            })

            console.log('sendmail', response.data)
            return response.data
        } catch (error) {
            console.error('Error sending email:', error)
            throw error
        }
    }

    async getWebhooks() {
        return {
            records: [] as {
                id: number;
                resource: string;
                notificationUrl: string;
                active: boolean;
                failSince: string;
                failDescription: string;
            }[],
            totalSize: 0,
            offset: 0,
            done: true,
        }
    }

    async createWebhook(_resource: string, _notificationUrl: string) {
        return await this.createSubscription()
    }

    async deleteWebhook(_subscriptionId: string) {
        const { gmail } = await this.getGmailClient()
        return await gmail.users.stop({ userId: 'me' })
    }
}

type EmailAddress = {
    name: string;
    address: string;
}

export default Account;
