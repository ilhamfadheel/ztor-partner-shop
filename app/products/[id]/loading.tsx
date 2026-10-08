import { Loading, ProductSkeleton } from "@/components/Skeletons";

export default function ProductLoading() {
  return (
    <Loading label="Loading product…">
      <span className="back-link" />
      <ProductSkeleton />
    </Loading>
  );
}
