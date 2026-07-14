'use client'
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

import React from 'react'
import { generateEmail, type EmailReasoning } from "./action"
import { readStreamableValue } from "ai/rsc"
import { Bot, RefreshCw, CheckCheck, Sparkles } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import useThreads from "../../use-threads"
import { useThread } from "../../use-thread"
import { turndown } from '@/lib/turndown'
import { cn } from "@/lib/utils"

type Props = {
    onGenerate: (value: string) => void
    isComposing?: boolean
}

const ConfidenceBar = ({ confidence }: { confidence: number }) => {
    const color =
        confidence >= 80 ? 'from-emerald-400 to-green-500' :
        confidence >= 55 ? 'from-yellow-400 to-amber-500' :
        'from-red-400 to-orange-500';

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-muted-foreground">AI Confidence</span>
                <span className={cn(
                    "text-xs font-bold",
                    confidence >= 80 ? 'text-emerald-500' :
                    confidence >= 55 ? 'text-amber-500' : 'text-red-500'
                )}>
                    {confidence}%
                </span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                    className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out", color)}
                    style={{ width: `${confidence}%` }}
                />
            </div>
        </div>
    )
}

const AIComposeButton = (props: Props) => {
    const [prompt, setPrompt] = React.useState('')
    const [open, setOpen] = React.useState(false)
    const [step, setStep] = React.useState<'prompt' | 'reasoning'>('prompt')
    const [reasoning, setReasoning] = React.useState<EmailReasoning | null>(null)
    const [generatedText, setGeneratedText] = React.useState('')
    const [isLoading, setIsLoading] = React.useState(false)

    const { account, threads } = useThreads()
    const [threadId] = useThread();
    const thread = threads?.find(t => t.id === threadId)

    const resetDialog = () => {
        setStep('prompt')
        setReasoning(null)
        setGeneratedText('')
        setPrompt('')
        setIsLoading(false)
    }

    const handleClose = (open: boolean) => {
        setOpen(open)
        if (!open) resetDialog()
    }

    const aiGenerate = async (promptText: string) => {
        setIsLoading(true)
        let context: string | undefined = ''
        if (!props.isComposing) {
            context = thread?.emails.map(m =>
                `Subject: ${m.subject}\nFrom: ${m.from.address}\n\n${turndown.turndown(m.body ?? m.bodySnippet ?? '')}`
            ).join('\n')
        }

        const { output, reasoning: r } = await generateEmail(
            (context ?? '') + `\n\nMy name is: ${account?.name}`,
            promptText
        )

        setReasoning(r)

        let fullText = ''
        for await (const delta of readStreamableValue(output)) {
            if (delta) {
                fullText += delta
            }
        }
        setGeneratedText(fullText)
        setIsLoading(false)
        setStep('reasoning')
    }

    const handleAccept = () => {
        props.onGenerate(generatedText)
        setOpen(false)
        resetDialog()
    }

    const handleRetry = () => {
        setStep('prompt')
        setReasoning(null)
        setGeneratedText('')
        setIsLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogTrigger asChild>
                <Button onClick={() => setOpen(true)} size='icon' variant={'outline'}>
                    <Bot className="size-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                {step === 'prompt' ? (
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Bot className="size-5 text-blue-500" />
                            AI Compose
                        </DialogTitle>
                        <DialogDescription>
                            AI will compose an email based on the context of your previous emails.
                        </DialogDescription>
                        <div className="h-2" />
                        <Textarea
                            placeholder="What would you like to compose? e.g. 'Write a follow-up about yesterday's meeting'"
                            value={prompt}
                            rows={3}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && prompt.trim()) {
                                    aiGenerate(prompt)
                                }
                            }}
                        />
                        <div className="h-2" />
                        <Button
                            disabled={!prompt.trim() || isLoading}
                            onClick={() => aiGenerate(prompt)}
                            className="w-full"
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <RefreshCw className="size-4 animate-spin" />
                                    Generating…
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <Sparkles className="size-4" />
                                    Generate
                                </span>
                            )}
                        </Button>
                        <p className="text-xs text-muted-foreground text-center">⌘ + Enter to generate</p>
                    </DialogHeader>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Sparkles className="size-5 text-blue-500" />
                            <h3 className="font-semibold text-sm">AI Reasoning</h3>
                        </div>

                        {/* Confidence Bar */}
                        {reasoning && <ConfidenceBar confidence={reasoning.confidence} />}

                        {/* Reasoning Chips */}
                        {reasoning && (
                            <div className="flex flex-wrap gap-2">
                                {reasoning.chips.map((chip, i) => (
                                    <span
                                        key={i}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900"
                                    >
                                        {chip.emoji} {chip.label}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Draft Preview */}
                        <div className="relative rounded-md border bg-muted/40 p-3 max-h-48 overflow-y-auto">
                            <p className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">Draft Preview</p>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{generatedText}</p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={handleRetry}>
                                <RefreshCw className="size-4 mr-1.5" />
                                Try again
                            </Button>
                            <Button className="flex-1" onClick={handleAccept}>
                                <CheckCheck className="size-4 mr-1.5" />
                                Use this draft
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}

export default AIComposeButton