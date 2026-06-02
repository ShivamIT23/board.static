"use client"

import { createContext, useContext } from "react"
import type { Socket } from "socket.io-client"

interface SocketContextType {
    socket: Socket | null
    isConnected: boolean
}

export const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
})

export const useSocket = () => useContext(SocketContext)
