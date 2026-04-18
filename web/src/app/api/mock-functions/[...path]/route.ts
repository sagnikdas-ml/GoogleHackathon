import { NextRequest } from 'next/server';

// Mock data for local development
let mockNotes: any[] = [];
let mockTasks: any[] = [];
let mockEvents: any[] = [];

function getNextId(items: any[]): string {
  return String(Math.max(0, ...items.map(item => parseInt(item.id) || 0)) + 1);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/mock-functions/', '');

  switch (path) {
    case 'notes':
      return Response.json(mockNotes);
    case 'tasks':
      return Response.json(mockTasks);
    case 'events':
      return Response.json(mockEvents);
    case 'progress':
      return Response.json({
        totalNotes: mockNotes.length,
        totalTasks: mockTasks.length,
        completedTasks: mockTasks.filter(t => t.status === 'done').length,
        pendingTasks: mockTasks.filter(t => t.status !== 'done').length,
        totalEvents: mockEvents.length,
        completionRate: mockTasks.length ? Math.round((mockTasks.filter(t => t.status === 'done').length / mockTasks.length) * 100) : 0
      });
    default:
      return Response.json({ error: 'Endpoint not found' }, { status: 404 });
  }
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/mock-functions/', '');

  try {
    const body = await request.json();

    switch (path) {
      case 'notes': {
        const newNote = {
          id: getNextId(mockNotes),
          title: body.title || '',
          content: body.content || '',
          subject: body.subject || '',
          createdAt: new Date().toISOString()
        };
        mockNotes.push(newNote);
        return Response.json(newNote, { status: 201 });
      }
      case 'tasks': {
        const newTask = {
          id: getNextId(mockTasks),
          title: body.title || '',
          subject: body.subject || '',
          dueDate: body.dueDate || '',
          status: body.status || 'todo',
          priority: body.priority || 'medium',
          createdAt: new Date().toISOString()
        };
        mockTasks.push(newTask);
        return Response.json(newTask, { status: 201 });
      }
      case 'events': {
        const newEvent = {
          id: getNextId(mockEvents),
          title: body.title || '',
          subject: body.subject || '',
          startTime: body.startTime || '',
          endTime: body.endTime || '',
          createdAt: new Date().toISOString()
        };
        mockEvents.push(newEvent);
        return Response.json(newEvent, { status: 201 });
      }
      case 'summarize': {
        return Response.json({
          summary: `Mock summary of: ${body.text?.substring(0, 50)}...`
        });
      }
      case 'quiz': {
        return Response.json({
          questions: [
            {
              question: 'Mock question 1?',
              answer: 'Mock answer 1',
              options: ['A', 'B', 'C', 'D']
            }
          ]
        });
      }
      default:
        return Response.json({ error: 'Endpoint not found' }, { status: 404 });
    }
  } catch (error) {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  const url = new URL(request.url);
  const pathParts = url.pathname.replace('/api/mock-functions/', '').split('/');
  const collection = pathParts[0];
  const id = pathParts[1];

  if (!id) {
    return Response.json({ error: 'ID required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    let collectionArray: any[];

    switch (collection) {
      case 'notes':
        collectionArray = mockNotes;
        break;
      case 'tasks':
        collectionArray = mockTasks;
        break;
      case 'events':
        collectionArray = mockEvents;
        break;
      default:
        return Response.json({ error: 'Collection not found' }, { status: 404 });
    }

    const index = collectionArray.findIndex(item => item.id === id);
    if (index === -1) {
      return Response.json({ error: 'Item not found' }, { status: 404 });
    }

    const updatedItem = {
      ...collectionArray[index],
      ...body,
      updatedAt: new Date().toISOString()
    };
    collectionArray[index] = updatedItem;

    return Response.json(updatedItem);
  } catch (error) {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const pathParts = url.pathname.replace('/api/mock-functions/', '').split('/');
  const collection = pathParts[0];
  const id = pathParts[1];

  if (!id) {
    return Response.json({ error: 'ID required' }, { status: 400 });
  }

  let collectionArray: any[];

  switch (collection) {
    case 'notes':
      collectionArray = mockNotes;
      break;
    case 'tasks':
      collectionArray = mockTasks;
      break;
    case 'events':
      collectionArray = mockEvents;
      break;
    default:
      return Response.json({ error: 'Collection not found' }, { status: 404 });
  }

  const index = collectionArray.findIndex(item => item.id === id);
  if (index === -1) {
    return Response.json({ error: 'Item not found' }, { status: 404 });
  }

  collectionArray.splice(index, 1);
  return Response.json({ message: 'Deleted successfully' });
}