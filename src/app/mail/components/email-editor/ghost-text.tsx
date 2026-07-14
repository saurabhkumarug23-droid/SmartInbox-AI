import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import React from 'react'

const GhostText = (props: NodeViewProps) => {
    return (
        <NodeViewWrapper as='span' className="relative inline">
            <NodeViewContent className="text-gray-300 select-none !inline" as='span'>
                {props.node.attrs.content}
            </NodeViewContent>
            {/* Explainability tooltip */}
            <span
                className="
                    absolute left-0 -bottom-7 z-50
                    inline-flex items-center gap-1
                    px-2 py-0.5 rounded-full
                    text-[10px] font-medium whitespace-nowrap
                    bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm
                    border border-gray-200 dark:border-gray-700
                    text-blue-600 dark:text-blue-400
                    shadow-sm pointer-events-none
                    animate-in fade-in duration-200
                "
            >
                ✨ AI suggestion · Tab to accept
            </span>
        </NodeViewWrapper>
    )
}

export default GhostText