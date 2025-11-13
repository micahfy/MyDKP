import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))'
        },
        // 添加魔兽世界职业颜色
        wow: {
          warrior: '#C79C6E',
          paladin: '#F58CBA', 
          hunter: '#ABD473',
          rogue: '#FFF569',
          priest: '#FFFFFF',
          shaman: '#0070DE',
          mage: '#69CCF0',
          warlock: '#9482C9',
          druid: '#FF7D0A',
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0'
          },
          to: {
            height: 'var(--radix-accordion-content-height)'
          }
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)'
          },
          to: {
            height: '0'
          }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      }
    }
  },
  plugins: [require('tailwindcss-animate')],
  // 添加 safelist 确保动态类名被包含
  safelist: [
    // 魔兽世界职业文字颜色
    'text-wow-warrior',
    'text-wow-paladin',
    'text-wow-hunter',
    'text-wow-rogue',
    'text-wow-priest', 
    'text-wow-shaman',
    'text-wow-mage',
    'text-wow-warlock',
    'text-wow-druid',
    
    // 魔兽世界职业背景颜色
    'bg-wow-warrior/20',
    'bg-wow-paladin/20',
    'bg-wow-hunter/20',
    'bg-wow-rogue/20',
    'bg-wow-priest/20',
    'bg-wow-shaman/20',
    'bg-wow-mage/20',
    'bg-wow-warlock/20',
    'bg-wow-druid/20',
    
    // 魔兽世界职业边框颜色
    'border-wow-warrior/50',
    'border-wow-paladin/50',
    'border-wow-hunter/50',
    'border-wow-rogue/50',
    'border-wow-priest/50',
    'border-wow-shaman/50',
    'border-wow-mage/50',
    'border-wow-warlock/50',
    'border-wow-druid/50',
    'text-[#C79C6E]',
    'bg-[#C79C6E]/20',
    'border-[#C79C6E]/50',
    'text-[#F58CBA]',
    'bg-[#F58CBA]/20', 
    'border-[#F58CBA]/50',
    'text-[#ABD473]',
    'bg-[#ABD473]/20',
    'border-[#ABD473]/50',
    'text-[#FFF569]',
    'bg-[#FFF569]/20',
    'border-[#FFF569]/50',
    'text-[#FFFFFF]',
    'bg-[#FFFFFF]/20',
    'border-[#FFFFFF]/50',
    'text-[#0070DE]',
    'bg-[#0070DE]/20',
    'border-[#0070DE]/50',
    'text-[#69CCF0]',
    'bg-[#69CCF0]/20',
    'border-[#69CCF0]/50',
    'text-[#9482C9]',
    'bg-[#9482C9]/20',
    'border-[#9482C9]/50',
    'text-[#FF7D0A]',
    'bg-[#FF7D0A]/20',
    'border-[#FF7D0A]/50',
  ],
};

export default config;
