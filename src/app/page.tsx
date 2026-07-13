import React from 'react'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/theme-toggle"
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import { Mail, Brain, Search, Keyboard, Check, Shield, Zap } from 'lucide-react'

const LandingPage = async () => {
    const { userId } = await auth()
    if (userId) {
        return redirect('/mail')
    }
    
    return (
        <div className="min-h-screen flex flex-col font-sans">
            {/* Sticky Navigation */}
            <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/60 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex items-center gap-2 cursor-pointer">
                        <Mail className="size-6 text-blue-500" />
                        <span className="font-bold text-xl tracking-tight">SmartInbox AI</span>
                    </a>
                    <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
                        <Link href="#features" className="hover:text-foreground transition-colors">Features</Link>
                        <Link href="#pricing" className="hover:text-foreground transition-colors">Pricing</Link>
                        <Link href="#features" className="hover:text-foreground transition-colors">About</Link>
                    </nav>
                    <div className="flex items-center gap-4">
                        <ModeToggle />
                        <Link href="/sign-in" className="hidden md:block text-sm font-medium hover:underline">Sign In</Link>
                        <Link href="/sign-up">
                            <Button className="rounded-full">Get Started</Button>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="flex-1">
                {/* Hero Section */}
                <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] z-[-1]" />
                    <div className="container mx-auto px-4 text-center">
                        <div className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-sm font-medium text-blue-600 dark:text-blue-400 mb-8 backdrop-blur-sm">
                            <Zap className="size-4 mr-2" fill="currentColor" />
                            <span className="mr-2">New</span>
                            <span className="opacity-80">Daily AI Briefings available now</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
                            The minimalistic,<br />AI-powered email client.
                        </h1>
                        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10">
                            SmartInbox AI empowers you to manage your email at the speed of thought. Auto-categorization, semantic search, and AI drafted replies.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link href="/mail">
                                <Button size="lg" className="rounded-full px-8 text-base">Start for free</Button>
                            </Link>
                            <Link href="#features">
                                <Button size="lg" variant="outline" className="rounded-full px-8 text-base bg-background/50 backdrop-blur-md">See how it works</Button>
                            </Link>
                        </div>
                        
                        <div className="mt-20 relative max-w-5xl mx-auto">
                            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl blur opacity-20" />
                            <Image 
                                src='/demo.png' 
                                alt='SmartInbox AI Dashboard' 
                                width={1200} 
                                height={800} 
                                className='relative rounded-xl border border-white/10 shadow-2xl w-full object-cover' 
                            />
                        </div>
                    </div>
                </section>

                {/* Features Section */}
                <section id="features" className="py-24 bg-muted/30">
                    <div className="container mx-auto px-4">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl md:text-4xl font-bold mb-4">Experience the power of AI</h2>
                            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Everything you need to reach inbox zero faster and stay focused on what truly matters.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
                            {[
                                {
                                    icon: Brain,
                                    title: "AI-driven email RAG",
                                    desc: "Automatically prioritize, summarize, and draft replies with our context-aware AI system."
                                },
                                {
                                    icon: Search,
                                    title: "Semantic search",
                                    desc: "Don't remember the exact keywords? Just ask questions to find the email you're looking for."
                                },
                                {
                                    icon: Keyboard,
                                    title: "Shortcut-focused UI",
                                    desc: "Navigate your inbox, compose, and triage entirely from your keyboard. No mouse needed."
                                },
                                {
                                    icon: Zap,
                                    title: "Daily AI Briefings",
                                    desc: "Get a quick, intelligent summary of your day's most important emails and action items."
                                }
                            ].map((feature, i) => (
                                <div key={i} className="group relative bg-background/50 backdrop-blur-sm border rounded-2xl p-8 hover:-translate-y-1 transition-all duration-300 hover:shadow-2xl dark:hover:shadow-blue-500/10">
                                    <div className="size-12 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                        <feature.icon className="size-6" />
                                    </div>
                                    <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                                    <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Pricing Section */}
                <section id="pricing" className="py-24">
                    <div className="container mx-auto px-4">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
                            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Start for free, upgrade when you need more power.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                            {/* Basic Plan */}
                            <div className="border rounded-3xl p-8 bg-background/50 backdrop-blur-sm flex flex-col">
                                <h3 className="text-2xl font-bold mb-2">Basic</h3>
                                <p className="text-muted-foreground mb-6">Perfect for individuals wanting a cleaner inbox.</p>
                                <div className="mb-8">
                                    <span className="text-4xl font-extrabold">$0</span>
                                    <span className="text-muted-foreground">/forever</span>
                                </div>
                                <ul className="space-y-4 mb-8 flex-1">
                                    {['Connect 1 email account', 'Standard email client features', 'Basic search functionality', 'Community support'].map((item, i) => (
                                        <li key={i} className="flex items-center gap-3">
                                            <Check className="size-5 text-green-500 shrink-0" />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                                <Link href="/sign-up">
                                    <Button className="w-full rounded-full" variant="outline">Get Started Free</Button>
                                </Link>
                            </div>

                            {/* Pro Plan */}
                            <div className="relative rounded-3xl p-8 bg-background backdrop-blur-sm flex flex-col border border-blue-500/50 shadow-2xl dark:shadow-blue-500/10">
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-500 text-white text-sm font-semibold rounded-full">
                                    Most Popular
                                </div>
                                <h3 className="text-2xl font-bold mb-2">Pro</h3>
                                <p className="text-muted-foreground mb-6">For power users who want AI supercharges.</p>
                                <div className="mb-8">
                                    <span className="text-4xl font-extrabold">$9</span>
                                    <span className="text-muted-foreground">/month</span>
                                </div>
                                <ul className="space-y-4 mb-8 flex-1">
                                    {['Connect unlimited accounts', 'Daily AI Briefings', 'Unlimited AI Ask & Reply', 'Priority semantic search'].map((item, i) => (
                                        <li key={i} className="flex items-center gap-3">
                                            <Check className="size-5 text-blue-500 shrink-0" />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                                <Link href="/sign-up">
                                    <Button className="w-full rounded-full bg-blue-600 hover:bg-blue-700 text-white">
                                        Upgrade to Pro
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="border-t border-white/10 bg-background/50 backdrop-blur-sm py-12 mt-12">
                <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2">
                        <Mail className="size-5 text-blue-500" />
                        <span className="font-bold">SmartInbox AI</span>
                    </div>
                    <p className="text-sm text-muted-foreground text-center md:text-left max-w-md">
                        Built for modern professionals who want to spend less time managing emails and more time doing meaningful work.
                    </p>
                    <div className="flex gap-6 text-sm text-muted-foreground">
                        <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
                        <Link href="/terms-of-service" className="hover:text-foreground transition-colors">Terms</Link>
                    </div>
                </div>
            </footer>
        </div>
    )
}

export default LandingPage