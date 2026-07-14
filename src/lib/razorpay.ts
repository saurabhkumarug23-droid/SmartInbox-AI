'server-only'
import Razorpay from 'razorpay'

const keyId = process.env.RAZORPAY_KEY_ID
const keySecret = process.env.RAZORPAY_KEY_SECRET

if (!keyId || !keySecret) {
    console.warn('RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not set')
}

export const razorpay = new Razorpay({
    key_id: keyId ?? '',
    key_secret: keySecret ?? '',
})
