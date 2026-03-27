import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTranslation } from "@/lib/i18n"
import { useCreateChannel } from "./chat.mutations"

const createChannelSchema = z.object({
  name: z.string().min(1).max(50),
  type: z.enum(["group", "direct", "broadcast"]),
  description: z.string().optional(),
})

type CreateChannelForm = z.infer<typeof createChannelSchema>

interface ChannelCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChannelCreateDialog({
  open,
  onOpenChange,
}: ChannelCreateDialogProps) {
  const { t } = useTranslation()
  const createChannel = useCreateChannel()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateChannelForm>({
    resolver: zodResolver(createChannelSchema),
    defaultValues: {
      name: "",
      type: "group",
      description: "",
    },
  })

  const channelType = watch("type")

  const onSubmit = handleSubmit((data) => {
    createChannel.mutate(
      {
        name: data.name,
        type: data.type,
        description: data.description,
      },
      {
        onSuccess: () => {
          reset()
          onOpenChange(false)
        },
      },
    )
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {t("chat.create_channel")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4 pt-2">
          {/* Channel name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="channel-name" className="font-heading text-xs">
              {t("chat.channel_name")}
            </Label>
            <Input
              id="channel-name"
              placeholder={t("chat.channel_name_placeholder")}
              {...register("name")}
              autoFocus
            />
            {errors.name && (
              <span className="text-[10px] text-destructive">
                {errors.name.message}
              </span>
            )}
          </div>

          {/* Channel type */}
          <div className="flex flex-col gap-1.5">
            <Label className="font-heading text-xs">
              {t("chat.channel_type")}
            </Label>
            <Select
              value={channelType}
              onValueChange={(val) =>
                setValue("type", val as CreateChannelForm["type"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="group">
                  {t("chat.channel_type_group")}
                </SelectItem>
                <SelectItem value="direct">
                  {t("chat.channel_type_direct")}
                </SelectItem>
                <SelectItem value="broadcast">
                  {t("chat.channel_type_broadcast")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="channel-desc" className="font-heading text-xs">
              {t("chat.channel_description")}
              <span className="ml-1 text-muted-foreground">
                ({t("common.optional")})
              </span>
            </Label>
            <Textarea
              id="channel-desc"
              placeholder={t("chat.channel_description_placeholder")}
              rows={2}
              {...register("description")}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={createChannel.isPending}>
              {t("common.create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
