import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { Flip } from 'gsap/Flip'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, Flip, CustomEase)

// The house curves: fast-out for UI, slow symmetric for anything "developing".
CustomEase.create('nftrium.out', '0.16, 1, 0.3, 1')
CustomEase.create('nftrium.develop', '0.65, 0, 0.35, 1')
gsap.defaults({ ease: 'nftrium.out', duration: 1 })

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export { Flip, ScrollTrigger, SplitText, gsap, useGSAP }
