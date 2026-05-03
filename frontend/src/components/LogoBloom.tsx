import { montserrat } from '../lib/fonts';

interface LogoBloomProps {
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: { title: 'text-3xl', flower: 'text-2xl', subtitle: 'text-[8px] tracking-[4px]', gap: 'mt-0.5' },
  md: { title: 'text-5xl', flower: 'text-4xl', subtitle: 'text-[11px] tracking-[5px]', gap: 'mt-1' },
  lg: { title: 'text-7xl', flower: 'text-6xl', subtitle: 'text-sm tracking-[6px]', gap: 'mt-1.5' },
};

export default function LogoBloom({ color = '#000000', size = 'md', className = '' }: LogoBloomProps) {
  const s = sizes[size];

  return (
    <div
      className={`inline-flex flex-col items-center select-none cursor-default ${montserrat.className} ${className}`}
      style={{ color }}
    >
      <div
        className={`${s.title} font-black leading-none flex items-center`}
        style={{ 
          letterSpacing: '-2px', 
          textShadow: color === '#ffffff' 
            ? '2px 2px 4px rgba(0,0,0,0.2)' 
            : '3px 3px 6px rgba(255,105,180,0.3), -2px -2px 6px rgba(255,255,255,0.8)' 
        }}
      >
        Bl
        <span className={s.flower} style={{ margin: '0 2px', color: '#ff69b4', textShadow: '2px 2px 4px rgba(255,105,180,0.4)' }}>✿</span>
        <span className={s.flower} style={{ margin: '0 2px', color: '#ff69b4', textShadow: '2px 2px 4px rgba(255,105,180,0.4)' }}>✿</span>
        m
      </div>
      <div
        className={`${s.subtitle} font-normal ${s.gap} w-full text-right opacity-80`}
        style={{ paddingRight: '4px' }}
      >
        BY LOLA
      </div>
    </div>
  );
}
