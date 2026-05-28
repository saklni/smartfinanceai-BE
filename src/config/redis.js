'use strict'

const Redis = require('ioredis')

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1'
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined
const REDIS_DB = Number(process.env.REDIS_DB) || 0

let redisClient = null
let isConnected = false

function createClient() {
  const client = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD || undefined,
    db: REDIS_DB,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 5) {
        console.warn('[Redis] Max retry tercapai. Redis tidak tersedia, fallback ke mode tanpa cache.')
        return null 
      }
      return Math.min(times * 200, 2000)
    },
    reconnectOnError(err) {
      const targetErrors = ['READONLY', 'ECONNRESET']
      return targetErrors.some((e) => err.message.includes(e))
    },
    enableOfflineQueue: false,
    lazyConnect: true,
  })

  client.on('connect', () => {
    isConnected = true
    console.log(`[Redis] Terhubung ke Memurai/Redis ${REDIS_HOST}:${REDIS_PORT} db=${REDIS_DB}`)
  })

  client.on('ready', () => {
    isConnected = true
  })

  client.on('error', (err) => {
    isConnected = false
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[Redis] Error:', err.message)
    }
  })

  client.on('close', () => {
    isConnected = false
  })

  return client
}

async function connect() {
  if (!redisClient) {
    redisClient = createClient()
  }
  try {
    await redisClient.connect()
  } catch (err) {
    console.warn('[Redis] Gagal konek, app berjalan tanpa cache:', err.message)
  }
}

function getClient() {
  return redisClient
}

function isReady() {
  return isConnected && redisClient !== null
}

async function set(key, value, ttlSeconds = null) {
  if (!isReady()) return false
  try {
    const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value)
    if (ttlSeconds) {
      await redisClient.set(key, serialized, 'EX', ttlSeconds)
    } else {
      await redisClient.set(key, serialized)
    }
    return true
  } catch (err) {
    console.warn('[Redis] set error:', err.message)
    return false
  }
}

async function get(key) {
  if (!isReady()) return null
  try {
    const val = await redisClient.get(key)
    if (val === null) return null
    try { return JSON.parse(val) } catch { return val }
  } catch (err) {
    console.warn('[Redis] get error:', err.message)
    return null
  }
}

async function del(key) {
  if (!isReady()) return false
  try {
    await redisClient.del(key)
    return true
  } catch (err) {
    console.warn('[Redis] del error:', err.message)
    return false
  }
}

async function exists(key) {
  if (!isReady()) return false
  try {
    const result = await redisClient.exists(key)
    return result === 1
  } catch (err) {
    console.warn('[Redis] exists error:', err.message)
    return false
  }
}

async function incr(key, ttlSeconds = null) {
  if (!isReady()) return null
  try {
    const val = await redisClient.incr(key)
    if (val === 1 && ttlSeconds) {
      await redisClient.expire(key, ttlSeconds)
    }
    return val
  } catch (err) {
    console.warn('[Redis] incr error:', err.message)
    return null
  }
}

async function ttl(key) {
  if (!isReady()) return -1
  try {
    return await redisClient.ttl(key)
  } catch {
    return -1
  }
}

const keys = {
  resetToken: (token) => `sf:reset_token:${token}`,
  profileCache: (userId) => `sf:cache:profile:${userId}`,
  categoriesCache: () => `sf:cache:categories`,
  recommendationsCache: (userId) => `sf:cache:recommendations:${userId}`,
  sessionBlacklist: (jti) => `sf:session_blacklist:${jti}`,
}

const TTL = {
  RESET_TOKEN: 10 * 60,       
  PROFILE_CACHE: 5 * 60,      
  CATEGORIES_CACHE: 60 * 60,  
  RECOMMENDATIONS_CACHE: 30 * 60, 
  SESSION_BLACKLIST: 7 * 24 * 60 * 60, 
}

module.exports = { connect, getClient, isReady, set, get, del, exists, incr, ttl, keys, TTL }
