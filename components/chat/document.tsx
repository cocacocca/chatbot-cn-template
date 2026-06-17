import { memo } from "react";
import { useArtifact } from "@/hooks/use-artifact";
import type { ArtifactKind } from "./artifact";
import { FileIcon, LoaderIcon, MessageIcon, PencilEditIcon } from "./icons";

const getActionText = (
  type: "create" | "update" | "request-suggestions",
  tense: "present" | "past"
) => {
  switch (type) {
    case "create":
      return tense === "present" ? "创建中" : "已创建";
    case "update":
      return tense === "present" ? "更新中" : "已更新";
    case "request-suggestions":
      return tense === "present" ? "添加建议中" : "已添加建议到";
    default:
      return null;
  }
};

type DocumentToolResultProps = {
  type: "create" | "update" | "request-suggestions";
  result: { id: string; title: string; kind: ArtifactKind };
};

function PureDocumentToolResult({ type, result }: DocumentToolResultProps) {
  const { setArtifact } = useArtifact();

  return (
    <button
      className="flex w-fit cursor-pointer flex-row items-center gap-2 rounded-xl border bg-background px-3 py-2"
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();

        const boundingBox = {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        };

        setArtifact((currentArtifact) => ({
          documentId: result.id,
          kind: result.kind,
          content: currentArtifact.content,
          title: result.title,
          isVisible: true,
          status: "idle",
          boundingBox,
        }));
      }}
      type="button"
    >
      <div className="text-muted-foreground">
        {type === "create" ? (
          <FileIcon />
        ) : type === "update" ? (
          <PencilEditIcon />
        ) : type === "request-suggestions" ? (
          <MessageIcon />
        ) : null}
      </div>
      <div className="text-left">
        {`${getActionText(type, "past")} "${result.title}"`}
      </div>
    </button>
  );
}

export const DocumentToolResult = memo(PureDocumentToolResult, () => true);

type DocumentToolCallProps = {
  type: "create" | "update" | "request-suggestions";
  args:
    | { title: string; kind: ArtifactKind }
    | { id: string; description: string }
    | { documentId: string };
};

function PureDocumentToolCall({ type, args }: DocumentToolCallProps) {
  const { setArtifact } = useArtifact();

  return (
    <button
      className="cursor pointer flex w-fit flex-row items-start justify-between gap-3 rounded-xl border px-3 py-2"
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();

        const boundingBox = {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        };

        setArtifact((currentArtifact) => ({
          ...currentArtifact,
          isVisible: true,
          boundingBox,
        }));
      }}
      type="button"
    >
      <div className="flex flex-row items-start gap-3">
        <div className="mt-1 text-neutral-500">
          {type === "create" ? (
            <FileIcon />
          ) : type === "update" ? (
            <PencilEditIcon />
          ) : type === "request-suggestions" ? (
            <MessageIcon />
          ) : null}
        </div>

        <div className="text-left">
          {`${getActionText(type, "present")} ${
            type === "create" && "title" in args && args.title
              ? `"${args.title}"`
              : type === "update" && "description" in args
                ? `"${args.description}"`
                : type === "request-suggestions"
                  ? "文档"
                  : ""
          }`}
        </div>
      </div>

      <div className="mt-1 animate-spin">{<LoaderIcon />}</div>
    </button>
  );
}

export const DocumentToolCall = memo(PureDocumentToolCall, () => true);
