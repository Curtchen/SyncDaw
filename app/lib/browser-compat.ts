// 浏览器兼容性工具
export class BrowserCompat {
  static isEdge(): boolean {
    return /Edge|Edg/.test(navigator.userAgent)
  }

  static isChrome(): boolean {
    return /Chrome/.test(navigator.userAgent) && !/Edge|Edg/.test(navigator.userAgent)
  }

  static isSafari(): boolean {
    return /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)
  }

  static async requestAudioPermission(): Promise<boolean> {
    try {
      // 在Edge中，需要更明确的用户交互
      if (this.isEdge()) {
        console.log('🌐 Detected Edge browser, using enhanced audio permission flow')
        
        // 创建一个临时的AudioContext来测试权限
        const testContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        
        // 在Edge中，resume()可能需要用户交互
        if (testContext.state === 'suspended') {
          await testContext.resume()
        }
        
        await testContext.close()
        return true
      }
      
      // 其他浏览器的标准流程
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop())
      return true
    } catch (error) {
      console.error('❌ Audio permission failed:', error)
      return false
    }
  }

  static async createAudioContext(): Promise<AudioContext | null> {
    try {
      console.log('🔧 Creating AudioContext...')
      
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) {
        throw new Error('AudioContext not supported')
      }

      const context = new AudioContextClass()
      console.log('📱 Initial AudioContext state:', context.state)
      
      // 特别是在Edge中，AudioContext可能需要用户交互才能启动
      if (context.state === 'suspended') {
        console.log('🔄 AudioContext suspended, attempting to resume...')
        
        if (this.isEdge()) {
          console.log('🌐 Edge detected: Creating resume handler')
          
          // 在Edge中，我们需要等待用户交互
          const resumePromise = this.waitForUserInteractionAndResume(context)
          
          // 但是我们也立即返回context，以便初始化可以继续
          // 实际的resume会在用户交互时发生
          console.log('📱 Returning context for Edge, will resume on user interaction')
          return context
        } else {
          // 其他浏览器立即尝试恢复
          await context.resume()
          console.log('✅ AudioContext resumed successfully')
        }
      }
      
      console.log('✅ AudioContext created successfully')
      return context
    } catch (error) {
      console.error('❌ Failed to create AudioContext:', error)
      return null
    }
  }

  static async waitForUserInteractionAndResume(context: AudioContext): Promise<void> {
    return new Promise((resolve) => {
      const resumeHandler = async () => {
        try {
          if (context.state === 'suspended') {
            await context.resume()
            console.log('✅ AudioContext resumed after user interaction')
          }
          resolve()
        } catch (error) {
          console.error('❌ Failed to resume AudioContext:', error)
          resolve() // 即使失败也要resolve，避免卡住
        }
      }

      // 监听多种用户交互事件
      const events = ['click', 'touchstart', 'keydown', 'mousedown']
      const cleanup = () => {
        events.forEach(event => {
          document.removeEventListener(event, resumeHandler)
        })
      }

      events.forEach(event => {
        document.addEventListener(event, resumeHandler, { once: true })
      })

      // 5秒后清理事件监听器
      setTimeout(() => {
        cleanup()
        resolve()
      }, 5000)
    })
  }

  static preventEventInterference(event: Event) {
    // Edge有时会有事件冒泡问题
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
  }

  static addClickHandlerWithEdgeFix(element: HTMLElement, handler: (e: Event) => void) {
    const wrappedHandler = (e: Event) => {
      this.preventEventInterference(e)
      
      // Edge需要额外的延迟来确保事件处理
      if (this.isEdge()) {
        setTimeout(() => handler(e), 0)
      } else {
        handler(e)
      }
    }

    element.addEventListener('click', wrappedHandler, { passive: false })
    element.addEventListener('mousedown', wrappedHandler, { passive: false })
    
    return () => {
      element.removeEventListener('click', wrappedHandler)
      element.removeEventListener('mousedown', wrappedHandler)
    }
  }
}
