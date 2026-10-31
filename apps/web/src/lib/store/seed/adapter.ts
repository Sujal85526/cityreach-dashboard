import { Bytes, clone } from '../values'

type Doc = Record<string, unknown>
export type SeedCollections = Record<string, Record<string, Doc>>

interface Ref {
  collection: string
  id: string
}

/**
 * A tiny write-only handle used by the seed files: `db.collection(c).doc(id)` plus a bulk
 * writer, collected into plain collections that the store takes over on first load.
 */
export class SeedDb {
  readonly data: SeedCollections = {}

  collection(name: string) {
    return { doc: (id: string): Ref => ({ collection: name, id }) }
  }

  bulkWriter() {
    return {
      set: (ref: Ref, doc: Doc) => {
        ;(this.data[ref.collection] ??= {})[ref.id] = clone(doc)
      },
      update: (ref: Ref, patch: Doc) => {
        const target = this.data[ref.collection]?.[ref.id]
        if (!target) throw new Error(`Seed refers to a missing document: ${ref.collection}/${ref.id}`)
        Object.assign(target, clone(patch))
      },
      close: () => undefined,
    }
  }
}

export const bytesOf = (text: string) => Bytes.fromUint8Array(new TextEncoder().encode(text))
