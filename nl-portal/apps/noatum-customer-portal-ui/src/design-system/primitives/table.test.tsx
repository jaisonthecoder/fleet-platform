import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

afterEach(cleanup);

describe('table primitive', () => {
  it('uses the semantic border token on header and body rows', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>MSCARRIER1</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    for (const row of screen.getAllByRole('row')) {
      expect(row).toHaveClass('border-border');
    }
  });
});
