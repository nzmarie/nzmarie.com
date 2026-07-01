import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const session = await auth();
  
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await marieDB.query(
      `UPDATE outreach_tasks
       SET status = 'SENT',
           sent_at = NOW(),
           sent_by = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [session.user.email, params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error marking task as sent:', error);
    return NextResponse.json(
      { error: 'Failed to mark task as sent' },
      { status: 500 }
    );
  }
}
