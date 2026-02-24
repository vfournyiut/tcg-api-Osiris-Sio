import 'socket.io'

declare module 'socket.io' {
  interface Socket {
    user?: {
      userId: number
      email: string
    }
  }
}
