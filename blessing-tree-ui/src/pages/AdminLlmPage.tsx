import { AdminFeatureFlagsCard } from '@/features/admin/ui/AdminFeatureFlagsCard';
import { AdminLlmConfigCard } from '@/features/admin/ui/AdminLlmConfigCard';

export function AdminLlmPage() {
  return (
    <div className="row g-4">
      <div className="col-12">
        <AdminLlmConfigCard />
      </div>
      <div className="col-12">
        <AdminFeatureFlagsCard />
      </div>
    </div>
  );
}
