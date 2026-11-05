import { useLayoutEffect } from 'react'
import { exactOnly, fromEnglish, messageTemplates } from '../lib/dictionaries'
import { createTranslator } from '../lib/translateText'
import { useStore } from '../store'

import type { Lang } from '../lib/language'

// Rules (whole-text matches, phrase substitution, guarded short words, exact-only keys): src/lib/translateText.ts
const { translate } = createTranslator({ fromEnglish, exactOnly, templates: messageTemplates })

const translatedAttributes = ['aria-label', 'placeholder', 'title', 'alt']
const canonicalText = new WeakMap<Text, string>()
const canonicalAttributes = new WeakMap<Element, Map<string, string>>()

function canonicalEnglish(value: string) {
  return translate(value, 'en')
}

function translateTree(root: ParentNode, lang: Lang) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  for (const node of nodes) {
    const parent = node.parentElement
    if (!parent || parent.closest('script, style, [data-i18n-skip]')) continue
    const previousCanonical = canonicalText.get(node)
    if (!previousCanonical || (node.data !== previousCanonical && node.data !== translate(previousCanonical, 'lo') && node.data !== translate(previousCanonical, 'th'))) {
      canonicalText.set(node, canonicalEnglish(node.data))
    }
    const next = translate(canonicalText.get(node) || node.data, lang)
    if (next !== node.data) node.data = next
  }

  const elements =
    root instanceof Element ? [root, ...root.querySelectorAll('*')] : [...root.querySelectorAll('*')]
  for (const element of elements) {
    for (const attribute of translatedAttributes) {
      const value = element.getAttribute(attribute)
      if (!value) continue
      let attributes = canonicalAttributes.get(element)
      if (!attributes) {
        attributes = new Map()
        canonicalAttributes.set(element, attributes)
      }
      const previousCanonical = attributes.get(attribute)
      if (!previousCanonical || (value !== previousCanonical && value !== translate(previousCanonical, 'lo') && value !== translate(previousCanonical, 'th'))) {
        attributes.set(attribute, canonicalEnglish(value))
      }
      const next = translate(attributes.get(attribute) || value, lang)
      if (next !== value) element.setAttribute(attribute, next)
    }
  }
}

/**
 * Compatibility layer for pages created before the keyed catalogue. It keeps
 * their canonical English data untouched while ensuring every rendered route,
 * modal, toast and form follows the single global language state.
 */
export default function GlobalLanguage() {
  const { lang } = useStore()

  useLayoutEffect(() => {
    const root = document.getElementById('root')
    if (!root) return

    translateTree(root, lang)
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData' && mutation.target.parentNode) {
          translateTree(mutation.target.parentNode, lang)
        }
        for (const node of mutation.addedNodes) {
          if (node instanceof Element || node instanceof DocumentFragment) translateTree(node, lang)
          else if (node.nodeType === Node.TEXT_NODE && node.parentNode) translateTree(node.parentNode, lang)
        }
      }
    })
    observer.observe(root, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [lang])

  return null
}
