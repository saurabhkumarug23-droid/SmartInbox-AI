'use client'
import React from 'react'
import { api } from '@/trpc/react'
import { useLocalStorage } from 'usehooks-ts'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sparkles, Calendar as CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

import { cn } from '@/lib/utils'

const DailyBriefing = ({ isCollapsed }: { isCollapsed?: boolean }) => {
    const [accountId] = useLocalStorage('accountId', '')
    const [isOpen, setIsOpen] = React.useState(false)
    const [date, setDate] = React.useState<Date | undefined>(undefined)

    // Set date to today on mount to avoid hydration mismatch
    React.useEffect(() => {
        setDate(new Date())
    }, [])

    const { data, isLoading, error } = api.briefing.getDailyBriefing.useQuery(
        { accountId, date: date?.toISOString() }, 
        { enabled: !!accountId && isOpen }
    )

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button 
                    variant="ghost" 
                    className={cn(
                        'w-full justify-start',
                        isCollapsed ? 'h-9 w-9 p-0 justify-center' : ''
                    )}
                >
                    <Sparkles className={cn('size-4', isCollapsed ? '' : 'mr-2')} />
                    {!isCollapsed && "Daily Briefing"}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="size-5 text-blue-500" />
                            Daily Briefing
                        </DialogTitle>
                    </div>
                    <div className="flex flex-col gap-2 pt-2">
                        <DialogDescription>
                            A quick summary of emails and priorities.
                        </DialogDescription>
                        
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-[240px] justify-start text-left font-normal",
                                        !date && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={setDate}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </DialogHeader>

                {isLoading && (
                    <div className="flex flex-col gap-4 py-4">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-[80%]" />
                        <Skeleton className="h-4 w-[90%]" />
                    </div>
                )}

                {error && (
                    <div className="text-red-500 text-sm py-4">
                        Failed to load briefing.
                    </div>
                )}

                {data?.briefing && (
                    <ScrollArea className="max-h-[60vh] pr-4">
                        <div className="flex flex-col gap-4 py-4">
                            <div className="text-sm text-zinc-700 dark:text-zinc-300 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-100 dark:border-blue-900/50">
                                {data.briefing.overallSummary}
                            </div>
                            
                            {data.briefing.topPriorities.length > 0 && (
                                <div>
                                    <h4 className="font-semibold text-sm mb-2">Key Highlights</h4>
                                    <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                                        {data.briefing.topPriorities.slice(0, 3).map((item, index) => (
                                            <li key={index}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                )}

                {data && !data.briefing && (
                    <div className="py-4 text-center text-sm text-muted-foreground flex flex-col items-center">
                        <Sparkles className="size-8 text-zinc-400 mb-2" />
                        You're all caught up! No emails to brief you on for this date.
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}

export default DailyBriefing
