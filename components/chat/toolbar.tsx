"use client";
/** @file Artifact 视图中的工具栏组件，提供快捷操作和状态控制 */
import cx from "classnames";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { WrenchIcon, XIcon } from "lucide-react";
import { nanoid } from "nanoid";
import {
  type Dispatch,
  memo,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { useOnClickOutside } from "usehooks-ts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ChatMessage } from "@/lib/types";
import { type ArtifactKind, artifactDefinitions } from "./artifact";
import type { ArtifactToolbarItem } from "./create-artifact";
import { ArrowUpIcon, StopIcon, SummarizeIcon } from "./icons";

/** Toolbar 组件使用的 sendMessage 类型，从 ActiveChatContextValue 中提取 */
type ToolbarSendMessage = (message: {
  role: "user";
  parts: Array<{ type: "text"; text: string }>;
}) => Promise<void>;

/** Toolbar 组件使用的 status 类型，从 ActiveChatContextValue 中提取 */
type ToolbarStatus = "ready" | "submitted" | "in_progress" | "error";

/** Toolbar 组件使用的 setMessages 类型，从 ActiveChatContextValue 中提取 */
type ToolbarSetMessages = (messages: ChatMessage[]) => void;

/** Toolbar 组件使用的 stop 类型，从 ActiveChatContextValue 中提取 */
type ToolbarStop = () => void;

type ToolProps = {
  description: string;
  icon: ReactNode;
  selectedTool: string | null;
  setSelectedTool: Dispatch<SetStateAction<string | null>>;
  isToolbarVisible?: boolean;
  setIsToolbarVisible?: Dispatch<SetStateAction<boolean>>;
  isAnimating: boolean;
  sendMessage: ToolbarSendMessage;
  onClick: ({ sendMessage }: { sendMessage: ToolbarSendMessage }) => void;
};

const Tool = ({
  description,
  icon,
  selectedTool,
  setSelectedTool,
  isToolbarVisible,
  setIsToolbarVisible,
  isAnimating,
  sendMessage,
  onClick,
}: ToolProps) => {
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (selectedTool !== description) {
      setIsHovered(false);
    }
  }, [selectedTool, description]);

  const handleSelect = () => {
    if (!isToolbarVisible && setIsToolbarVisible) {
      setIsToolbarVisible(true);
      return;
    }

    if (!selectedTool) {
      setIsHovered(true);
      setSelectedTool(description);
      return;
    }

    if (selectedTool === description) {
      setSelectedTool(null);
      onClick({ sendMessage });
    } else {
      setSelectedTool(description);
    }
  };

  return (
    <Tooltip open={isHovered && !isAnimating}>
      <TooltipTrigger asChild>
        <motion.div
          animate={{ opacity: 1, transition: { delay: 0.1 } }}
          className={cx("rounded-full p-3", {
            "bg-primary text-primary-foreground!": selectedTool === description,
          })}
          exit={{
            scale: 0.9,
            opacity: 0,
            transition: { duration: 0.1 },
          }}
          initial={{ scale: 1, opacity: 0 }}
          onClick={() => {
            handleSelect();
          }}
          onHoverEnd={() => {
            if (selectedTool !== description) {
              setIsHovered(false);
            }
          }}
          onHoverStart={() => {
            setIsHovered(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleSelect();
            }
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          {selectedTool === description ? <ArrowUpIcon /> : icon}
        </motion.div>
      </TooltipTrigger>
      <TooltipContent
        className="rounded-2xl bg-foreground p-3 px-4 text-background"
        side="left"
        sideOffset={16}
      >
        {description}
      </TooltipContent>
    </Tooltip>
  );
};

const randomArr = [...new Array(6)].map((_x) => nanoid(5));

const ReadingLevelSelector = ({
  setSelectedTool,
  sendMessage,
  isAnimating,
}: {
  setSelectedTool: Dispatch<SetStateAction<string | null>>;
  isAnimating: boolean;
  sendMessage: ToolbarSendMessage;
}) => {
  const LEVELS = [
    "Elementary",
    "Middle School",
    "Keep current level",
    "High School",
    "College",
    "Graduate",
  ];

  const y = useMotionValue(-40 * 2);
  const dragConstraints = 5 * 40 + 2;
  const yToLevel = useTransform(y, [0, -dragConstraints], [0, 5]);

  const [currentLevel, setCurrentLevel] = useState(2);
  const [hasUserSelectedLevel, setHasUserSelectedLevel] =
    useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = yToLevel.on("change", (latest) => {
      const level = Math.min(5, Math.max(0, Math.round(Math.abs(latest))));
      setCurrentLevel(level);
    });

    return () => unsubscribe();
  }, [yToLevel]);

  return (
    <div className="relative flex flex-col items-center justify-end">
      {randomArr.map((id) => (
        <motion.div
          animate={{ opacity: 1 }}
          className="flex size-[40px] flex-row items-center justify-center"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          key={id}
          transition={{ delay: 0.1 }}
        >
          <div className="size-2 rounded-full bg-muted-foreground/40" />
        </motion.div>
      ))}

      <TooltipProvider>
        <Tooltip open={!isAnimating}>
          <TooltipTrigger asChild>
            <motion.div
              className={cx(
                "absolute flex flex-row items-center rounded-full border bg-background p-3",
                {
                  "bg-primary text-primary-foreground": currentLevel !== 2,
                  "bg-background text-foreground": currentLevel === 2,
                }
              )}
              drag="y"
              dragConstraints={{ top: -dragConstraints, bottom: 0 }}
              dragElastic={0}
              dragMomentum={false}
              onClick={() => {
                if (currentLevel !== 2 && hasUserSelectedLevel) {
                  sendMessage({
                    role: "user",
                    parts: [
                      {
                        type: "text",
                        text: `Please adjust the reading level to ${LEVELS[currentLevel]} level.`,
                      },
                    ],
                  });

                  setSelectedTool(null);
                }
              }}
              onDragEnd={() => {
                if (currentLevel === 2) {
                  setSelectedTool(null);
                } else {
                  setHasUserSelectedLevel(true);
                }
              }}
              onDragStart={() => {
                setHasUserSelectedLevel(false);
              }}
              style={{ y }}
              transition={{ duration: 0.1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {currentLevel === 2 ? <SummarizeIcon /> : <ArrowUpIcon />}
            </motion.div>
          </TooltipTrigger>
          <TooltipContent
            className="rounded-2xl bg-foreground p-3 px-4 text-background text-sm"
            side="left"
            sideOffset={16}
          >
            {LEVELS[currentLevel]}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export const Tools = ({
  selectedTool,
  setSelectedTool,
  sendMessage,
  isAnimating,
  tools,
}: {
  selectedTool: string | null;
  setSelectedTool: Dispatch<SetStateAction<string | null>>;
  sendMessage: ToolbarSendMessage;
  isAnimating: boolean;
  tools: ArtifactToolbarItem[];
}) => {
  return (
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col gap-1.5"
      exit={{ opacity: 0, scale: 0.95 }}
      initial={{ opacity: 0, scale: 0.95 }}
    >
      {[...tools].reverse().map((tool) => (
        <Tool
          description={tool.description}
          icon={tool.icon}
          isAnimating={isAnimating}
          key={tool.description}
          onClick={tool.onClick}
          selectedTool={selectedTool}
          sendMessage={sendMessage}
          setSelectedTool={setSelectedTool}
        />
      ))}
    </motion.div>
  );
};

const createFixErrorTool = (
  consoleOutput: string,
  documentId?: string
): ArtifactToolbarItem => ({
  icon: <WrenchIcon className="size-4" />,
  description: "修复错误",
  onClick: ({ sendMessage: send }) => {
    send({
      role: "user",
      parts: [
        {
          type: "text",
          text: `Fix the error in the existing script${documentId ? ` (id: ${documentId})` : ""} using updateDocument. Do not create a new script. Console error:\n\n${consoleOutput}`,
        },
      ],
    });
  },
});

const PureToolbar = ({
  isToolbarVisible: _isToolbarVisible,
  setIsToolbarVisible,
  sendMessage,
  status,
  stop,
  setMessages: _setMessages,
  artifactKind,
  consoleError,
  documentId,
  artifactActions,
  onClose,
}: {
  isToolbarVisible: boolean;
  setIsToolbarVisible: Dispatch<SetStateAction<boolean>>;
  status: ToolbarStatus;
  sendMessage: ToolbarSendMessage;
  stop: ToolbarStop;
  setMessages: ToolbarSetMessages;
  artifactKind: ArtifactKind;
  consoleError?: string;
  documentId?: string;
  artifactActions?: ReactNode;
  onClose?: () => void;
}) => {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useOnClickOutside(toolbarRef, () => {
    setIsToolbarVisible(false);
    setSelectedTool(null);
  });

  const startCloseTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setSelectedTool(null);
      setIsToolbarVisible(false);
    }, 2000);
  };

  const cancelCloseTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (status === "in_progress") {
      setIsToolbarVisible(false);
    }
  }, [status, setIsToolbarVisible]);

  const artifactDefinition = artifactDefinitions.find(
    (definition) => definition.kind === artifactKind
  );

  if (!artifactDefinition) {
    throw new Error("Artifact definition not found!");
  }

  const toolsByArtifactKind = consoleError
    ? [
        createFixErrorTool(consoleError, documentId),
        ...artifactDefinition.toolbar.slice(1),
      ]
    : artifactDefinition.toolbar;

  if (toolsByArtifactKind.length === 0) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={0}>
      <motion.div
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="fixed right-6 bottom-6 z-50 flex cursor-pointer flex-col items-center rounded-3xl border bg-background py-1 shadow-lg"
        exit={{ opacity: 0, y: -20, transition: { duration: 0.1 } }}
        initial={{ opacity: 0, y: -20, scale: 1 }}
        onAnimationComplete={() => {
          setIsAnimating(false);
        }}
        onAnimationStart={() => {
          setIsAnimating(true);
        }}
        onHoverEnd={() => {
          if (status === "in_progress") {
            return;
          }

          startCloseTimer();
        }}
        onHoverStart={() => {
          if (status === "in_progress") {
            return;
          }

          cancelCloseTimer();
          setIsToolbarVisible(true);
        }}
        ref={toolbarRef}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        {onClose && (
          <motion.div
            animate={{ opacity: 1 }}
            className="p-3 text-muted-foreground transition-colors hover:text-foreground"
            initial={{ opacity: 0 }}
            onClick={onClose}
          >
            <XIcon className="size-4" />
          </motion.div>
        )}

        {status === "in_progress" ? (
          <motion.div
            animate={{ scale: 1.4 }}
            className="p-3"
            exit={{ scale: 1 }}
            initial={{ scale: 1 }}
            key="stop-icon"
            onClick={() => {
              stop();
            }}
          >
            <StopIcon />
          </motion.div>
        ) : selectedTool === "adjust-reading-level" ? (
          <ReadingLevelSelector
            isAnimating={isAnimating}
            key="reading-level-selector"
            sendMessage={sendMessage}
            setSelectedTool={setSelectedTool}
          />
        ) : (
          <>
            {artifactActions}
            <Tools
              isAnimating={isAnimating}
              key="tools"
              selectedTool={selectedTool}
              sendMessage={sendMessage}
              setSelectedTool={setSelectedTool}
              tools={toolsByArtifactKind}
            />
          </>
        )}
      </motion.div>
    </TooltipProvider>
  );
};

export const Toolbar = memo(PureToolbar, (prevProps, nextProps) => {
  if (prevProps.status !== nextProps.status) {
    return false;
  }
  if (prevProps.isToolbarVisible !== nextProps.isToolbarVisible) {
    return false;
  }
  if (prevProps.artifactKind !== nextProps.artifactKind) {
    return false;
  }
  if (prevProps.consoleError !== nextProps.consoleError) {
    return false;
  }
  if (prevProps.artifactActions !== nextProps.artifactActions) {
    return false;
  }
  if (prevProps.onClose !== nextProps.onClose) {
    return false;
  }

  return true;
});
