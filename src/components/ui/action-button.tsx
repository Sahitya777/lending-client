import Image from "next/image"

interface ActionButtonProps {
  onClick: () => void
  src: string
  alt: string
  className?: string
  imageClassName?: string
}

export function ActionButton({
  onClick,
  src,
  alt,
  className = "",
  imageClassName = "",
}: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`absolute top-2 z-20 hover:opacity-80 cursor-pointer transition-opacity outline-none`}
    >
        X
    </button>
  )
}
