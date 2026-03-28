import { MembersList } from "./members-list"
import { InviteSection } from "./invite-section"
import { RolesReference } from "./roles-reference"

/**
 * Team management: members list, invite list, roles, ban/unban.
 */
export function TeamManagement() {
  return (
    <div className="flex flex-col gap-8">
      <MembersList />
      <InviteSection />
      <RolesReference />
    </div>
  )
}
