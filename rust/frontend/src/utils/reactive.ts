export interface Subscription {
  unsubscribe(): void
}

export interface Observer<T> {
  next: (value: T) => void
error?: (error: unknown) => void
  complete?: () => void
}

export class Subject<T> {
  private observers: Observer<T>[] = []
  private isClosed = false

  subscribe(next: (value: T) => void, error?: (error: unknown) => void, complete?: () => void): Subscription {
    if (this.isClosed) {
      throw new Error('Cannot subscribe to a closed subject')
    }

    const observer: Observer<T> = { next }
    if (error) observer.error = error
    if (complete) observer.complete = complete

    this.observers.push(observer)

    return {
      unsubscribe: () => {
        const index = this.observers.indexOf(observer)
        if (index !== -1) {
          this.observers.splice(index, 1)
        }
      }
    }
  }

  next(value: T): void {
    if (this.isClosed) return

    this.observers.forEach(observer => {
      try {
        observer.next(value)
      } catch (error) {
        console.error('Error in observer:', error)
        if (observer.error) {
          observer.error(error)
        }
      }
    })
  }

  error(error: unknown): void {
    if (this.isClosed) return

    this.observers.forEach(observer => {
      if (observer.error) {
        try {
          observer.error(error)
        } catch (e) {
          console.error('Error in error handler:', e)
        }
      }
    })
    this.close()
  }

  complete(): void {
    if (this.isClosed) return

    this.observers.forEach(observer => {
      if (observer.complete) {
        try {
          observer.complete()
        } catch (error) {
          console.error('Error in complete handler:', error)
        }
      }
    })
    this.close()
  }

  private close(): void {
    this.isClosed = true
    this.observers.length = 0
  }

  get hasObservers(): boolean {
    return this.observers.length > 0
  }

  get observerCount(): number {
    return this.observers.length
  }
}

export class BehaviorSubject<T> extends Subject<T> {
  constructor(private _value: T) {
    super()
  }

  get value(): T {
    return this._value
  }

  next(value: T): void {
    this._value = value
    super.next(value)
  }

  subscribe(next: (value: T) => void, error?: (error: unknown) => void, complete?: () => void): Subscription {
    const subscription = super.subscribe(next, error, complete)
    
    try {
      next(this._value)
    } catch (err) {
      console.error('Error emitting current value:', err)
      if (error) {
        error(err)
      }
    }

    return subscription
  }
}