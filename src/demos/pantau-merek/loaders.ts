/** demos/pantau-merek/loaders.ts — the lazy parts (one loader each; intent helpers call them before the click) */
export const loadReviews = () => import('./Reviews')
export const loadCompetitors = () => import('./Competitors')
export const loadCluster = () => import('./Cluster')
export const loadOwner = () => import('./OwnerBand')
export const loadBulk = () => import('./BulkReply')
export const loadAsk = () => import('./Ask')
