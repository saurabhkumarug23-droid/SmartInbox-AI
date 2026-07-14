'use client'
import { Button } from '@/components/ui/button'
import { getSubscriptionStatus, cancelSubscription } from '@/lib/razorpay-actions'
import React from 'react'
import { toast } from 'sonner'

declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Razorpay: any
    }
}

const RazorpayButton = () => {
    const [isSubscribed, setIsSubscribed] = React.useState(false)
    const [isLoading, setIsLoading] = React.useState(false)

    React.useEffect(() => {
        (async () => {
            const status = await getSubscriptionStatus()
            setIsSubscribed(status)
        })()
    }, [])

    // Load Razorpay checkout script on mount
    React.useEffect(() => {
        const script = document.createElement('script')
        script.src = 'https://checkout.razorpay.com/v1/checkout.js'
        script.async = true
        document.body.appendChild(script)
        return () => {
            if (document.body.contains(script)) {
                document.body.removeChild(script)
            }
        }
    }, [])

    const handleUpgrade = async () => {
        setIsLoading(true)
        try {
            // Create order on server
            const res = await fetch('/api/razorpay/create-subscription', { method: 'POST' })
            if (!res.ok) throw new Error('Failed to create order')

            const { orderId, amount, currency, keyId } = await res.json() as {
                orderId: string
                amount: number
                currency: string
                keyId: string
            }

            // Open Razorpay checkout popup
            const rzp = new window.Razorpay({
                key: keyId,
                amount,
                currency,
                order_id: orderId,
                name: 'SmartInbox AI',
                description: 'Pro Plan – 1 Year Access',
                theme: { color: '#6366f1' },
                handler: async (response: {
                    razorpay_payment_id: string
                    razorpay_order_id: string
                    razorpay_signature: string
                }) => {
                    // Verify payment on server
                    const verify = await fetch('/api/razorpay/verify-payment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(response),
                    })
                    if (verify.ok) {
                        toast.success('Payment successful! Welcome to Pro 🎉')
                        setIsSubscribed(true)
                    } else {
                        toast.error('Payment verification failed. Contact support.')
                    }
                    setIsLoading(false)
                },
                modal: {
                    ondismiss: () => setIsLoading(false),
                },
            })
            rzp.open()
        } catch (error: any) {
            toast.error(error?.message || 'Something went wrong')
            setIsLoading(false)
        }
    }

    const handleCancel = async () => {
        setIsLoading(true)
        try {
            await cancelSubscription()
            toast.success('Pro access removed.')
            setIsSubscribed(false)
        } catch (error: any) {
            toast.error(error?.message || 'Failed to cancel')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Button
            variant='outline'
            size='lg'
            disabled={isLoading}
            onClick={isSubscribed ? handleCancel : handleUpgrade}
        >
            {isLoading
                ? 'Processing…'
                : isSubscribed
                    ? 'Manage Subscription'
                    : 'Upgrade Plan'}
        </Button>
    )
}

export default RazorpayButton