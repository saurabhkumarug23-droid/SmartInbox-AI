"use client"

import * as React from "react"
import Link from 'next/link'

import { cn } from "@/lib/utils"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Separator } from "@/components/ui/separator"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AccountSwitcher } from "@/app/mail/components/account-switcher"
import { ThreadDisplay } from "./thread-display"
import { ThreadList } from "./thread-list"
import { useLocalStorage } from "usehooks-ts"
import SideBar from "./sidebar"
import SearchBar, { isSearchingAtom } from "./search-bar"
import { useAtom } from "jotai"
import AskAI from "./ask-ai"
import { UserButton } from "@clerk/nextjs"
import { ModeToggle } from "@/components/theme-toggle"
import ComposeButton from "./compose-button"


interface MailProps {
  defaultLayout: number[] | undefined
  defaultCollapsed?: boolean
  navCollapsedSize: number
}

export function Mail({
  defaultLayout = [20, 32, 48],
  defaultCollapsed = false,
  navCollapsedSize,
}: MailProps) {
  const [tab] = useLocalStorage('smartinbox-tab', 'inbox')
  const [done, setDone] = useLocalStorage('smartinbox-done', false)
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed)
  const [isMounted, setIsMounted] = React.useState(false)

  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  return (
    <TooltipProvider delayDuration={0}>
      <ResizablePanelGroup
        direction="horizontal"
        onLayout={(sizes: number[]) => {
          document.cookie = `react-resizable-panels:layout:mail=${JSON.stringify(
            sizes
          )}`
        }}
        className="items-stretch h-full min-h-screen"
      >
        <ResizablePanel
          defaultSize={defaultLayout[0]}
          collapsedSize={navCollapsedSize}
          collapsible={true}
          minSize={15}
          maxSize={40}
          onCollapse={() => {
            setIsCollapsed(true)
            document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(
              true
            )}`
          }}
          onResize={() => {
            setIsCollapsed(false)
            document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(
              false
            )}`
          }}
          className={cn(
            isCollapsed &&
            "min-w-[50px] transition-all duration-300 ease-in-out"
          )}
        >
          <div className="flex h-full flex-col">
            <div
              className={cn(
                "flex h-[52px] items-center gap-2",
                isCollapsed ? "h-[52px] justify-center" : "px-2"
              )}
            >
              <Link href="/" className="flex items-center gap-2 cursor-pointer">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-6 text-blue-500"
                >
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                {!isCollapsed && <span className="font-bold text-xl">SmartInbox</span>}
              </Link>
            </div>
            <Separator />
            <div
              className={cn(
                "flex h-[52px] items-center justify-between",
                isCollapsed ? "h-[52px] justify-center" : "px-2"
              )}
            >
              <AccountSwitcher isCollapsed={isCollapsed} />
            </div>
            <Separator />
            
            <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
              <SideBar isCollapsed={isCollapsed} />
              <div className="mt-auto"></div>
              <AskAI isCollapsed={isCollapsed} />
            </div>
            <div className="p-4 flex items-center justify-center">
              <div className="flex items-center gap-2">
                <ComposeButton isCollapsed={isCollapsed} />

                {!isCollapsed && <ModeToggle />}
                {!isCollapsed && <UserButton />}
              </div>
            </div>
          </div>

        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={defaultLayout[1]} minSize={30}>
          <Tabs defaultValue="inbox" value={done ? 'done' : 'inbox'} onValueChange={t => {
            if (t === 'done') {
              setDone(true)
            } else {
              setDone(false)
            }
          }}>
            <div className="flex items-center px-4 py-2">
              <h1 className="text-xl font-bold capitalize">{isMounted ? tab : 'inbox'}</h1>
              <TabsList className="ml-auto">
                <TabsTrigger
                  value="inbox"
                  className="text-zinc-600 dark:text-zinc-200 capitalize"
                >
                  {isMounted ? tab : 'inbox'}
                </TabsTrigger>
                <TabsTrigger
                  value="done"
                  className="text-zinc-600 dark:text-zinc-200"
                >
                  Done
                </TabsTrigger>
              </TabsList>
            </div>
            <Separator />
            <SearchBar />
            <TabsContent value="inbox" className="m-0">
              <ThreadList />
            </TabsContent>
            <TabsContent value="done" className="m-0">
              <ThreadList />
            </TabsContent>
          </Tabs>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={defaultLayout[2]} minSize={30}>
          <ThreadDisplay />
        </ResizablePanel>
      </ResizablePanelGroup>
    </TooltipProvider>
  )
}
