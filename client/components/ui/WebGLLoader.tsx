interface WebGLLoaderProps {
  text?: string;
  subText?: string;
}

export default function WebGLLoader({
  text = "Yuklanmoqda...",
  subText = "Iltimos kuting",
}: WebGLLoaderProps) {
  return (
    <div className="fixed inset-0 z-[99999] bg-gray-950 flex flex-col items-center justify-center overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-red-950/20 to-gray-950" />
      
      {/* Animated gradient orbs - more red */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-red-600/10 rounded-full blur-3xl animate-pulse" />
      <div
        className="absolute bottom-1/4 right-1/4 w-56 h-56 bg-red-500/15 rounded-full blur-3xl animate-pulse"
        style={{ animationDelay: "0.5s" }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/5 rounded-full blur-3xl"
      />

      {/* Logo container with effects */}
      <div className="relative flex items-center justify-center mb-10">
        {/* Outer glow ring - red pulse */}
        <div
          className="absolute w-44 h-44 rounded-full border-2 border-red-500/30 animate-ping"
          style={{ animationDuration: "2s" }}
        />
        
        {/* Middle ring - gradient */}
        <div
          className="absolute w-40 h-40 rounded-full border-2 border-red-500/20"
        />
        
        {/* Spinning ring - red accent */}
        <div
          className="absolute w-36 h-36 rounded-full border-[3px] border-transparent border-t-red-500 border-r-red-500/50 animate-spin"
          style={{ animationDuration: "1.2s" }}
        />
        
        {/* Inner spinning ring - opposite direction */}
        <div
          className="absolute w-32 h-32 rounded-full border-2 border-transparent border-b-red-400/60 border-l-red-400/30 animate-spin"
          style={{ animationDuration: "1.5s", animationDirection: "reverse" }}
        />
        
        {/* Inner glow - red */}
        <div className="absolute w-28 h-28 bg-red-500/20 rounded-full blur-xl animate-pulse" />
        
        {/* Logo */}
        <img
          src="/logo.png"
          alt="AvtoFix"
          className="w-24 h-24 object-contain relative z-10 drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]"
        />
      </div>

      {/* Text content */}
      <div className="relative z-10 text-center">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
          {text}
        </h2>
        <p className="text-gray-400 text-sm">
          {subText}
        </p>

        {/* Loading bar - red gradient */}
        <div className="mt-8 w-48 h-1.5 bg-gray-800/50 rounded-full overflow-hidden mx-auto">
          <div className="h-full w-full bg-gradient-to-r from-red-600 via-red-500 to-red-600 rounded-full animate-loading-bar" />
        </div>
        
        {/* Loading dots - red */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce shadow-lg shadow-red-500/50" style={{ animationDelay: "0ms" }} />
          <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce shadow-lg shadow-red-500/50" style={{ animationDelay: "150ms" }} />
          <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce shadow-lg shadow-red-500/50" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}
