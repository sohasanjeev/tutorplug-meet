import { io } from 'socket.io-client';

async function testFullFlow() {
  console.log('--- 1. Creating meeting via REST API ---');
  const createRes = await fetch('http://localhost:5000/api/meetings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Automatic Continuous Recording Live Test' }),
  });
  const createData = await createRes.json();
  const meetingCode = createData.meeting.code;
  const meetingId = createData.meeting.id;
  console.log(`Meeting created: ${meetingCode} (ID: ${meetingId})`);

  console.log('\n--- 2. Connecting Participant (Host) via Socket.io ---');
  const socket1 = io('http://localhost:5000');

  await new Promise((resolve) => {
    socket1.on('connect', () => {
      console.log('Socket connected. Emitting join-room...');
      socket1.emit('join-room', {
        meetingCode,
        displayName: 'Dr. Sarah Connor (Host)',
        role: 'host',
      });
    });

    socket1.on('room-joined', (data) => {
      console.log('Joined room:', data.meetingTitle);
      console.log('Automatic Recording status received:', data.recording);
      if (data.recording?.isRecording) {
        console.log('>>> [VERIFIED] Continuous Automatic Recording started immediately upon first join!');
      }
      resolve(true);
    });
  });

  console.log('\n--- 3. Ingesting continuous media recording chunks to server ---');
  for (let i = 1; i <= 4; i++) {
    const mockWebMChunk = Buffer.from(`RAW_WEBM_VIDEO_AUDIO_ENCODED_STREAM_SEGMENT_${i}`);
    socket1.emit('recording-chunk', mockWebMChunk);
    console.log(`Piped continuous chunk #${i} into server-side file stream`);
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log('\n--- 4. Sending in-meeting chat message & live reaction ---');
  socket1.emit('send-chat', {
    content: 'All attendees please note: This meeting is automatically recorded and archived.',
    messageType: 'text',
  });
  socket1.emit('send-reaction', { emoji: '🔥' });
  await new Promise((r) => setTimeout(r, 600));

  console.log('\n--- 5. Host clicks "End meeting for all" ---');
  await new Promise((resolve) => {
    socket1.on('meeting-ended-by-host', (data) => {
      console.log('Host concluded meeting.');
      console.log('Finalized Recording object:', data.recording);
      resolve(true);
    });
    socket1.emit('host-end-meeting-all');
  });

  socket1.disconnect();

  console.log('\n--- 6. Querying Meeting Detail & Recordings Hub ---');
  const detailRes = await fetch(`http://localhost:5000/api/meetings/detail/${meetingId}`);
  const detailData = await detailRes.json();
  console.log('Meeting Status in DB:', detailData.meeting.status);
  console.log('Recording Status in DB:', detailData.recording?.status);
  console.log('Recording Duration:', detailData.recording?.duration_seconds, 'seconds');
  console.log('Recording File Name:', detailData.recording?.file_name);
  console.log('Recording Storage Size:', detailData.recording?.size_bytes, 'bytes');
  console.log('Total Messages Archived:', detailData.messages?.length);
  console.log('Total Participants Logged:', detailData.participants?.length);

  if (detailData.recording?.status === 'ready' && detailData.recording?.duration_seconds >= 1) {
    console.log('\n=============================================================');
    console.log('🎉 SUCCESS: AUTOMATIC RECORDING & CONFERENCING TEST PASSED!');
    console.log('=============================================================');
  } else {
    console.error('Test failed: Recording did not finalize to ready state.');
    process.exit(1);
  }
}

testFullFlow().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
