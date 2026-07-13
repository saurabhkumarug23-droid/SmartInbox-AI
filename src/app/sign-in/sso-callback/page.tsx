import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'

export default function SSOCallback() {
  return <AuthenticateWithRedirectCallback signInForceRedirectUrl="/mail" signUpForceRedirectUrl="/mail" />
}
