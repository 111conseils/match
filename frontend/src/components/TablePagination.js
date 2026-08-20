import { Button } from './ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Pagination de tableau.
 *
 * Le backend ne plafonne plus les listes : sans pagination, une base de
 * plusieurs milliers de lignes serait rendue d'un bloc et figerait le navigateur.
 */
export default function TablePagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  label = 'élément',
  testId = 'pagination'
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalItems <= pageSize) return null;

  const premier = (page - 1) * pageSize + 1;
  const dernier = Math.min(page * pageSize, totalItems);

  return (
    <div
      className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t"
      data-testid={testId}
    >
      <p className="text-sm text-muted-foreground">
        {premier}–{dernier} sur {totalItems} {label}{totalItems > 1 ? 's' : ''}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          data-testid={`${testId}-prev`}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Précédent
        </Button>
        <span className="text-sm text-muted-foreground px-2">
          Page {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          data-testid={`${testId}-next`}
        >
          Suivant
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
