import { google } from 'googleapis'
import type { gmail_v1 } from 'googleapis'
import type { EmailMessage, EmailAddress, EmailHeader, EmailAttachment } from './types'
import { db } from '@/server/db'

export function getGoogleClientId(): string {
    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not configured')
    return clientId
}

export function getGoogleClientSecret(): string {
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    if (!clientSecret) throw new Error('GOOGLE_CLIENT_SECRET is not configured')
    return clientSecret
}

export function getRedirectUri(): string {
    if (process.env.NODE_ENV === 'development') {
        return 'http://localhost:3001/api/google/callback'
    }
    return `${process.env.NEXT_PUBLIC_URL}/api/google/callback`
}

export function createGoogleOAuth2Client() {
    return new google.auth.OAuth2(
        getGoogleClientId(),
        getGoogleClientSecret(),
        getRedirectUri(),
    )
}

export function decodeBase64Url(data: string): string {
    const normalized = data.replace(/-/g, '+').replace(/_/g, '/')
    const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
    return Buffer.from(normalized + padding, 'base64').toString('utf-8')
}

export function encodeBase64Url(data: string): string {
    return Buffer.from(data, 'utf-8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
}

export function parseEmailAddressHeader(value: string | undefined): EmailAddress {
    if (!value) {
        return { name: '', address: '' }
    }

    const match = value.match(/^(?:"?([^"]*)"?\s)?<?([^>]+@[^>]+)>?$/)
    if (!match) {
        return { name: '', address: value.trim(), raw: value }
    }

    return {
        name: match[1]?.trim() ?? '',
        address: match[2]?.trim() ?? value.trim(),
        raw: value,
    }
}

export function parseEmailAddressList(value: string | undefined): EmailAddress[] {
    if (!value) return []

    const addresses: EmailAddress[] = []
    let current = ''
    let inQuotes = false

    for (const char of value) {
        if (char === '"') {
            inQuotes = !inQuotes
            current += char
            continue
        }

        if (char === ',' && !inQuotes) {
            if (current.trim()) {
                addresses.push(parseEmailAddressHeader(current.trim()))
            }
            current = ''
            continue
        }

        current += char
    }

    if (current.trim()) {
        addresses.push(parseEmailAddressHeader(current.trim()))
    }

    return addresses
}

export function formatEmailAddress(address: { name?: string; address: string }): string {
    if (address.name?.trim()) {
        return `"${address.name.replace(/"/g, '\\"')}" <${address.address}>`
    }
    return address.address
}

export function getHeaderValue(headers: EmailHeader[] | undefined, name: string): string | undefined {
    return headers?.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value
}

function mapGmailLabelsToSysLabels(labelIds: string[] | null | undefined): EmailMessage['sysLabels'] {
    const labels = labelIds ?? []
    const sysLabels = new Set<EmailMessage['sysLabels'][number]>()

    if (labels.includes('INBOX')) sysLabels.add('inbox')
    if (labels.includes('SENT')) sysLabels.add('sent')
    if (labels.includes('DRAFT')) sysLabels.add('draft')
    if (labels.includes('UNREAD')) sysLabels.add('unread')
    if (labels.includes('STARRED')) sysLabels.add('flagged')
    if (labels.includes('IMPORTANT')) sysLabels.add('important')
    if (labels.includes('TRASH')) sysLabels.add('trash')
    if (labels.includes('SPAM')) sysLabels.add('junk')

    if (sysLabels.size === 0) {
        sysLabels.add('inbox')
    }

    return [...sysLabels]
}

function extractBodyFromPart(part: gmail_v1.Schema$MessagePart): { body?: string; attachments: EmailAttachment[] } {
    const attachments: EmailAttachment[] = []
    let body: string | undefined

    if (part.filename && part.body?.attachmentId) {
        attachments.push({
            id: part.body.attachmentId,
            name: part.filename,
            mimeType: part.mimeType ?? 'application/octet-stream',
            size: part.body.size ?? 0,
            inline: part.headers?.some((header) =>
                header.name?.toLowerCase() === 'content-disposition' &&
                header.value?.toLowerCase().includes('inline'),
            ) ?? false,
            contentId: getHeaderValue(
                part.headers?.map((header) => ({ name: header.name ?? '', value: header.value ?? '' })),
                'Content-ID',
            )?.replace(/^<|>$/g, ''),
        })
    } else if (part.mimeType === 'text/html' && part.body?.data) {
        body = decodeBase64Url(part.body.data)
    } else if (part.mimeType === 'text/plain' && part.body?.data && !body) {
        body = decodeBase64Url(part.body.data)
    }

    for (const child of part.parts ?? []) {
        const nested = extractBodyFromPart(child)
        if (!body && nested.body) {
            body = nested.body
        }
        attachments.push(...nested.attachments)
    }

    return { body, attachments }
}

export function mapGmailMessageToEmailMessage(message: gmail_v1.Schema$Message): EmailMessage {
    const headers: EmailHeader[] = (message.payload?.headers ?? []).map((header) => ({
        name: header.name ?? '',
        value: header.value ?? '',
    }))

    const internalDate = message.internalDate
        ? new Date(Number(message.internalDate)).toISOString()
        : new Date().toISOString()

    const sentAtHeader = getHeaderValue(headers, 'Date')
    const sentAt = sentAtHeader ? new Date(sentAtHeader).toISOString() : internalDate

    const { body, attachments } = message.payload
        ? extractBodyFromPart(message.payload)
        : { body: undefined, attachments: [] as EmailAttachment[] }

    return {
        id: message.id ?? '',
        threadId: message.threadId ?? '',
        createdTime: internalDate,
        lastModifiedTime: internalDate,
        sentAt,
        receivedAt: internalDate,
        internetMessageId: getHeaderValue(headers, 'Message-ID') ?? message.id ?? '',
        subject: getHeaderValue(headers, 'Subject') ?? '',
        sysLabels: mapGmailLabelsToSysLabels(message.labelIds),
        keywords: message.labelIds ?? [],
        sysClassifications: [],
        sensitivity: 'normal',
        from: parseEmailAddressHeader(getHeaderValue(headers, 'From')),
        to: parseEmailAddressList(getHeaderValue(headers, 'To')),
        cc: parseEmailAddressList(getHeaderValue(headers, 'Cc')),
        bcc: parseEmailAddressList(getHeaderValue(headers, 'Bcc')),
        replyTo: parseEmailAddressList(getHeaderValue(headers, 'Reply-To')),
        hasAttachments: attachments.length > 0,
        body,
        bodySnippet: message.snippet ?? undefined,
        attachments,
        inReplyTo: getHeaderValue(headers, 'In-Reply-To'),
        references: getHeaderValue(headers, 'References'),
        internetHeaders: headers,
        nativeProperties: {
            historyId: message.historyId ?? '',
            sizeEstimate: String(message.sizeEstimate ?? 0),
        },
        folderId: message.labelIds?.[0],
        omitted: [],
    }
}

export function buildRfc2822Message({
    from,
    subject,
    body,
    inReplyTo,
    references,
    to,
    cc,
    bcc,
    replyTo,
}: {
    from: { name?: string; address: string }
    subject: string
    body: string
    inReplyTo?: string
    references?: string
    to: { name?: string; address: string }[]
    cc?: { name?: string; address: string }[]
    bcc?: { name?: string; address: string }[]
    replyTo?: { name?: string; address: string }
}): string {
    const lines = [
        `From: ${formatEmailAddress(from)}`,
        `To: ${to.map(formatEmailAddress).join(', ')}`,
    ]

    if (cc?.length) {
        lines.push(`Cc: ${cc.map(formatEmailAddress).join(', ')}`)
    }

    if (bcc?.length) {
        lines.push(`Bcc: ${bcc.map(formatEmailAddress).join(', ')}`)
    }

    if (replyTo) {
        lines.push(`Reply-To: ${formatEmailAddress(replyTo)}`)
    }

    lines.push(`Subject: ${subject}`)
    lines.push('MIME-Version: 1.0')
    lines.push('Content-Type: text/html; charset=utf-8')

    if (inReplyTo) {
        lines.push(`In-Reply-To: ${inReplyTo}`)
    }

    if (references) {
        lines.push(`References: ${references}`)
    }

    lines.push('', body)

    return lines.join('\r\n')
}

type AccountBinaryIndex = {
    historyId?: string
    watchExpiration?: string
}

export async function getAuthenticatedGmailClient(accessToken: string) {
    const account = await db.account.findUnique({
        where: { accessToken },
    })

    if (!account) {
        throw new Error('Invalid token')
    }

    const oauth2Client = createGoogleOAuth2Client()
    oauth2Client.setCredentials({
        access_token: account.accessToken,
        refresh_token: account.refreshToken ?? undefined,
        expiry_date: account.expiryDate.getTime(),
    })

    const isExpired = account.expiryDate.getTime() <= Date.now() + 60_000

    if (isExpired) {
        if (!account.refreshToken) {
            throw new Error('Access token expired and no refresh token is available')
        }

        const { credentials } = await oauth2Client.refreshAccessToken()

        if (!credentials.access_token) {
            throw new Error('Failed to refresh Google access token')
        }

        await db.account.update({
            where: { id: account.id },
            data: {
                accessToken: credentials.access_token,
                expiryDate: new Date(credentials.expiry_date ?? Date.now() + 3600_000),
                ...(credentials.refresh_token ? { refreshToken: credentials.refresh_token } : {}),
            },
        })

        oauth2Client.setCredentials(credentials)

        return {
            account: {
                ...account,
                accessToken: credentials.access_token,
                expiryDate: new Date(credentials.expiry_date ?? Date.now() + 3600_000),
            },
            gmail: google.gmail({ version: 'v1', auth: oauth2Client }),
            oauth2Client,
        }
    }

    return {
        account,
        gmail: google.gmail({ version: 'v1', auth: oauth2Client }),
        oauth2Client,
    }
}

export function getStoredHistoryId(binaryIndex: unknown): string | undefined {
    if (!binaryIndex || typeof binaryIndex !== 'object') return undefined
    const historyId = (binaryIndex as AccountBinaryIndex).historyId
    return typeof historyId === 'string' ? historyId : undefined
}

export async function storeHistoryId(accountId: string, historyId: string) {
    const account = await db.account.findUnique({
        where: { id: accountId },
        select: { binaryIndex: true },
    })

    const existing = (account?.binaryIndex ?? {}) as AccountBinaryIndex

    await db.account.update({
        where: { id: accountId },
        data: {
            binaryIndex: {
                ...existing,
                historyId,
            },
        },
    })
}
