import type { Segment } from '#/types/transcripts'

type Meeting = {
  id: string
  title?: string
  createdAt: number
}

const DB_NAME = 'meeting_copilot_transcripts'
const DB_VERSION = 1
const STORE_MEETINGS = 'meetings'
const STORE_SEGMENTS = 'segments'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_MEETINGS)) {
        db.createObjectStore(STORE_MEETINGS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_SEGMENTS)) {
        const store = db.createObjectStore(STORE_SEGMENTS, { keyPath: 'id' })
        store.createIndex('by_meeting', 'meetingId', { unique: false })
        store.createIndex('by_meeting_start', ['meetingId', 'start'], {
          unique: false,
        })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => T | Promise<T>,
): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const store = tx.objectStore(storeName)
    Promise.resolve(fn(store)).then((v) => {
      tx.oncomplete = () => resolve(v)
      tx.onerror = () => reject(tx.error)
    }, reject)
  })
}

export async function createMeeting(meeting: Meeting): Promise<void> {
  await withStore(STORE_MEETINGS, 'readwrite', (store) => store.put(meeting))
}

export async function addSegment(segment: Segment): Promise<void> {
  await withStore(STORE_SEGMENTS, 'readwrite', (store) => store.put(segment))
}

export async function getMeeting(meetingId: string): Promise<Meeting | null> {
  return withStore(STORE_MEETINGS, 'readonly', (store) => {
    return new Promise<Meeting | null>((resolve, reject) => {
      const req = store.get(meetingId)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
    })
  })
}

export async function getSegments(meetingId: string): Promise<Segment[]> {
  return withStore(STORE_SEGMENTS, 'readonly', (store) => {
    return new Promise<Segment[]>((resolve, reject) => {
      const idx = store.index('by_meeting_start')
      const range = IDBKeyRange.bound(
        [meetingId, -Infinity],
        [meetingId, Infinity],
      )
      const req = idx.openCursor(range)
      const out: Segment[] = []
      req.onsuccess = () => {
        const cur = req.result
        if (!cur) {
          resolve(out)
          return
        }
        out.push(cur.value as Segment)
        cur.continue()
      }
      req.onerror = () => reject(req.error)
    })
  })
}

export async function listMeetings(): Promise<Meeting[]> {
  return withStore(STORE_MEETINGS, 'readonly', (store) => {
    return new Promise<Meeting[]>((resolve, reject) => {
      const req = store.openCursor()
      const out: Meeting[] = []
      req.onsuccess = () => {
        const cur = req.result
        if (!cur) {
          resolve(out.sort((a, b) => b.createdAt - a.createdAt))
          return
        }
        out.push(cur.value as Meeting)
        cur.continue()
      }
      req.onerror = () => reject(req.error)
    })
  })
}

export async function clearMeeting(meetingId: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_MEETINGS, STORE_SEGMENTS], 'readwrite')
    const meetings = tx.objectStore(STORE_MEETINGS)
    const segments = tx.objectStore(STORE_SEGMENTS).index('by_meeting')
    meetings.delete(meetingId)
    const req = segments.openCursor(IDBKeyRange.only(meetingId))
    req.onsuccess = () => {
      const cur = req.result
      if (!cur) return
      cur.delete()
      cur.continue()
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export type { Meeting, Segment }
