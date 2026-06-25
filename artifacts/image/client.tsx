/** @file 图像 Artifact 客户端定义，负责图像编辑、版本切换与剪贴板复制 */
import { toast } from "sonner";
import { Artifact } from "@/components/chat/create-artifact";
import { CopyIcon, RedoIcon, UndoIcon } from "@/components/chat/icons";
import { ImageEditor } from "@/components/chat/image-editor";

export const imageArtifact = new Artifact({
  kind: "image",
  description: "Useful for image generation",
  // 处理流式数据：图像增量到达时立即展示并标记为 streaming
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === "data-imageDelta") {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: streamPart.data as string,
        isVisible: true,
        status: "streaming",
      }));
    }
  },
  content: ImageEditor,
  actions: [
    {
      icon: <UndoIcon size={18} />,
      description: "View Previous version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("prev");
      },
      // 当前已是第一版时禁用回退
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <RedoIcon size={18} />,
      description: "View Next version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("next");
      },
      // 当前已是最新版时禁用前进
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <CopyIcon size={18} />,
      description: "Copy image to clipboard",
      // 将 base64 图像绘制到 canvas，再以 PNG Blob 写入剪贴板
      onClick: ({ content }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${content}`;

        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              navigator.clipboard.write([
                new ClipboardItem({ "image/png": blob }),
              ]);
            }
          }, "image/png");
        };

        toast.success("Copied image to clipboard!");
      },
    },
  ],
  toolbar: [],
});
