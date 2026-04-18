import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import api from '@/lib/api'

const STORAGE_KEY = 'hafa_behavior'

interface BehaviorData {
  categoryViews: Record<string, number>
  productViews:  Record<string, number>
  searches:      string[]
  lastVisit:     number
}

function load(): BehaviorData {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch { return { categoryViews: {}, productViews: {}, searches: [], lastVisit: Date.now() } }
}

function save(data: BehaviorData) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, lastVisit: Date.now() })) } catch {}
}

export function trackCategoryView(slug: string) {
  const d = load()
  d.categoryViews = d.categoryViews || {}
  d.categoryViews[slug] = (d.categoryViews[slug] || 0) + 1
  save(d)
}

export function trackProductView(id: string) {
  const d = load()
  d.productViews = d.productViews || {}
  d.productViews[id] = (d.productViews[id] || 0) + 1
  save(d)
}

export function trackSearch(term: string) {
  const d = load()
  d.searches = [term, ...(d.searches || []).filter(s => s !== term)].slice(0, 10)
  save(d)
}

export function getPersonalizedCategories(): string[] {
  const d = load()
  return Object.entries(d.categoryViews || {})
    .sort((a, b) => b[1] - a[1])
    .map(([slug]) => slug)
}

export function getPersonalizedSort(): string {
  const cats = getPersonalizedCategories()
  return cats.length > 0 ? cats[0] : ''
}

export function getCategoryScore(slug: string): number {
  const d = load()
  const views = d.categoryViews?.[slug] || 0
  const maxViews = Math.max(...Object.values(d.categoryViews || {}), 1)
  return Math.round((views / maxViews) * 100)
}

export function usePersonalization() {
  const { isAuthenticated } = useAuth()
  const localData = load()

  // Fetch server-side purchase history for logged-in users
  const { data: serverOrders } = useQuery({
    queryKey: ['personalization-orders'],
    queryFn: () => api.get('/orders?limit=20&status=DELIVERED').then(r => r.data.data),
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 10, // 10 min cache
  })

  // Merge server purchase categories with local behavior
  const serverCategories: string[] = (() => {
    if (!serverOrders?.length) return []
    const catScores: Record<string, number> = {}
    serverOrders.forEach((order: any) => {
      order.items?.forEach((item: any) => {
        const cat = item.product?.category?.slug
        if (cat) catScores[cat] = (catScores[cat] || 0) + 3 // purchases weight 3x
      })
    })
    return Object.entries(catScores).sort((a, b) => b[1] - a[1]).map(([slug]) => slug)
  })()

  const localCategories = getPersonalizedCategories()

  // Merge: server categories first (purchase-based), then local (browse-based)
  const merged = [...new Set([...serverCategories, ...localCategories])]

  return {
    topCategories: merged,
    recentSearches: localData.searches || [],
    trackCategoryView,
    trackProductView,
    trackSearch,
    getCategoryScore,
  }
}
