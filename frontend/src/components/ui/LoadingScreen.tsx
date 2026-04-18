export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-bounce">🌿</div>
        <div className="text-xl font-bold text-green-primary">Hafa Market</div>
        <div className="mt-4 w-48 h-1 bg-gray-100 rounded-full overflow-hidden mx-auto">
          <div className="h-full bg-gradient-to-r from-green-primary to-green-mid rounded-full animate-[loading_1.5s_ease-in-out_infinite]" />
        </div>
      </div>
      <style>{`@keyframes loading{0%{width:0;margin-left:0}50%{width:100%;margin-left:0}100%{width:0;margin-left:100%}}`}</style>
    </div>
  )
}
