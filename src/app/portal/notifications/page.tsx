import { NotificationList } from '@/components/portal/notification-list';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { requireVerifiedUser } from '@/lib/auth';
import { getNotifications } from '@/lib/data/applicant';

export const metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  const { user } = await requireVerifiedUser();
  const notifications = await getNotifications(user.id, 50);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">Notifications</h1>
        <p className="mt-1 text-sm text-slate-600">
          Every update about your registration is recorded here, with the date it happened.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Recent activity"
          description="Notifications are created by the programme itself — nothing here is placeholder content."
        />
        <CardBody>
          <NotificationList notifications={notifications} />
        </CardBody>
      </Card>
    </div>
  );
}
