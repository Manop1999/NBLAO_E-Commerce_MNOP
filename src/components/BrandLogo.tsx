export const LOGO_SRC = '/nb-lao-logo.png'

export default function BrandLogo({ className = 'h-9', onDark = false }: { className?: string; onDark?: boolean }) {
  const img = <img src={LOGO_SRC} alt="NB Lao Sole Company Limited" className={`${className} w-auto block shrink-0`} />
  return onDark ? <span className="inline-flex bg-white px-2 py-1 rounded-sm">{img}</span> : img
}
