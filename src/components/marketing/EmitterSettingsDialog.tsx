import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ImagePlus, Trash2, Loader2 } from 'lucide-react'
import { useOrgSettings, useUpdateOrgSettings } from '@/hooks/useOrgSettings'
import { resizeLogo, MAX_LOGO_BYTES } from '@/lib/quotes'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onClose: () => void
}

const EMPTY = {
  legal_name: '', ruc: '', address: '', email: '',
  phone: '', website: '', default_terms: '',
}

/**
 * Datos del emisor: la cabecera de todas las cotizaciones. Solo admin.
 * Se leen en vivo, así que cambiar el RUC acá lo cambia en todos los
 * documentos, incluidos los links públicos ya enviados.
 */
export default function EmitterSettingsDialog({ open, onClose }: Props) {
  const { data: org, isLoading } = useOrgSettings()
  const update = useUpdateOrgSettings()
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState(EMPTY)
  const [logo, setLogo] = useState<string | null>(null)
  const [processingLogo, setProcessingLogo] = useState(false)

  useEffect(() => {
    if (!org) return
    setForm({
      legal_name: org.legal_name ?? '',
      ruc: org.ruc ?? '',
      address: org.address ?? '',
      email: org.email ?? '',
      phone: org.phone ?? '',
      website: org.website ?? '',
      default_terms: org.default_terms ?? '',
    })
    setLogo(org.logo_base64)
  }, [org, open])

  const handleLogo = async (file: File) => {
    setProcessingLogo(true)
    try {
      const dataUrl = await resizeLogo(file)
      if (dataUrl.length > MAX_LOGO_BYTES) {
        toast.error('El logo sigue pesando demasiado. Usa una imagen más simple o en PNG.')
        return
      }
      setLogo(dataUrl)
    } catch {
      toast.error('No se pudo leer la imagen')
    } finally {
      setProcessingLogo(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleSave = async () => {
    try {
      await update.mutateAsync({
        legal_name: form.legal_name,
        ruc: form.ruc,
        address: form.address || null,
        email: form.email || null,
        phone: form.phone || null,
        website: form.website || null,
        default_terms: form.default_terms || null,
        logo_base64: logo,
      })
      toast.success('Datos del emisor actualizados')
      onClose()
    } catch {
      toast.error('No se pudo guardar. ¿Tu usuario es admin?')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Datos del emisor</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Es la cabecera de todas las cotizaciones. Al cambiar algo acá cambia también en los
              documentos ya enviados.
            </p>

            {/* Logo */}
            <div className="space-y-1.5">
              <Label>Logo</Label>
              <div className="flex items-center gap-3">
                <div className="h-14 w-32 rounded-md border border-border flex items-center justify-center bg-muted/40 overflow-hidden shrink-0">
                  {logo
                    ? <img src={logo} alt="Logo" className="max-h-full max-w-full object-contain" />
                    : <span className="text-[11px] text-muted-foreground">Sin logo</span>}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button" variant="outline" size="sm"
                    disabled={processingLogo}
                    onClick={() => fileRef.current?.click()}
                  >
                    {processingLogo
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <ImagePlus className="h-4 w-4" />}
                    Subir
                  </Button>
                  {logo && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setLogo(null)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <input
                  ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handleLogo(file)
                  }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Se redimensiona a 400px de ancho automáticamente.
              </p>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Razón social</Label>
                <Input
                  value={form.legal_name}
                  onChange={e => setForm({ ...form, legal_name: e.target.value })}
                  placeholder="Mi Empresa S.A.C."
                />
              </div>
              <div className="space-y-1.5">
                <Label>RUC</Label>
                <Input
                  value={form.ruc}
                  onChange={e => setForm({ ...form, ruc: e.target.value })}
                  placeholder="20123456789"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Dirección</Label>
                <Input
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  placeholder="Av. Ejemplo 123, Lima"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Sitio web</Label>
                <Input
                  value={form.website}
                  onChange={e => setForm({ ...form, website: e.target.value })}
                  placeholder="miempresa.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Términos por defecto</Label>
              <Textarea
                rows={4}
                value={form.default_terms}
                onChange={e => setForm({ ...form, default_terms: e.target.value })}
                placeholder="50% adelanto, 50% contra entrega. Plazo de 15 días hábiles..."
              />
              <p className="text-[11px] text-muted-foreground">
                Se ofrecen como plantilla al armar una cotización nueva.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
              <Button type="button" size="sm" onClick={handleSave} disabled={update.isPending}>
                Guardar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
