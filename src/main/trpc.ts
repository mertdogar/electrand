import { initTRPC } from "@trpc/server"
import { EventEmitter } from "events"

export const ee = new EventEmitter()

const t = initTRPC.create({ isServer: true })

export const router = t.router
export const publicProcedure = t.procedure
