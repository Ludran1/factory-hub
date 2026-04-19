import { Component, type ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  reset = () => this.setState({ hasError: false, error: null })

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <div className="rounded-xl border-2 border-destructive/40 bg-destructive/5 p-8 text-center space-y-4 animate-fade-in">
        <AlertCircle className="h-10 w-10 mx-auto text-destructive" />
        <div>
          <p className="font-semibold">Algo salió mal en esta sección</p>
          <p className="text-sm text-muted-foreground mt-1">
            {this.state.error?.message ?? 'Error desconocido'}
          </p>
        </div>
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={this.reset} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Reintentar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
            Recargar página
          </Button>
        </div>
      </div>
    )
  }
}
