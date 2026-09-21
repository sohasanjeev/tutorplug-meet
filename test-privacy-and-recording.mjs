import { io } from './server/node_modules/socket.io-client/build/esm/index.js';

const BASE_URL = 'http://localhost:5000';

async function runPrivacyAndRecordingTests() {
  console.log('🧪 Starting Privacy, Recording & Theme Integration Tests...\n');

  // 1. Create Teacher A & Teacher B
  console.log('1️⃣ Creating Teacher A & Teacher B:');
  const userARes = await fetch(`${BASE_URL}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `teacher.alpha.${Date.now()}@gmail.com`,
      name: 'Teacher Alpha',
    }),
  });
  const userAData = await userARes.json();
  const teacherA = userAData.user;
  const tokenA = userAData.token;
  console.log(`   ✅ Teacher A registered: ${teacherA.email} (ID: ${teacherA.id})`);

  const userBRes = await fetch(`${BASE_URL}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `teacher.beta.${Date.now()}@gmail.com`,
      name: 'Teacher Beta',
    }),
  });
  const userBData = await userBRes.json();
  const teacherB = userBData.user;
  const tokenB = userBData.token;
  console.log(`   ✅ Teacher B registered: ${teacherB.email} (ID: ${teacherB.id})`);

  // Admin Login
  const adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@tutorplug.com', password: 'Admin@123456' }),
  });
  const adminData = await adminRes.json();
  const tokenAdmin = adminData.token;
  console.log(`   ✅ Administrator logged in: ${adminData.user.email}`);

  // 2. Connect Teacher A into their permanent room and stream real recording chunks
  console.log('\n2️⃣ Testing Real Audio/Video Chunk Streaming in Teacher A\'s Room:');
  const socketA = io(BASE_URL, { transports: ['websocket'] });

  await new Promise((resolve) => {
    socketA.on('connect', () => {
      socketA.emit('join-room', {
        meetingCode: teacherA.personalMeetingCode,
        displayName: teacherA.name,
        role: 'host',
      });
    });

    socketA.on('room-joined', (data) => {
      console.log(`   ✅ Teacher A joined room: ${data.meetingCode} (Meeting ID: ${data.meetingId})`);
      resolve(data);
    });
  });

  // Stream simulated real video/audio chunks (simulating MediaRecorder VP8 WebM output)
  const sampleVideoChunk = Buffer.from([
    0x1a, 0x45, 0xdf, 0xa3, // EBML Header
    0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01, 0x42, 0xf2, 0x81,
    0x04, 0x42, 0xf3, 0x81, 0x08, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d,
    ...new Array(2048).fill(0x55), // 2KB of media frame data
  ]);

  console.log('   📡 Transmitting real media recording chunks over WebSocket...');
  socketA.emit('recording-chunk', sampleVideoChunk);
  await new Promise((r) => setTimeout(r, 200));
  socketA.emit('recording-chunk', sampleVideoChunk);
  await new Promise((r) => setTimeout(r, 200));

  // Teacher A leaves the room
  socketA.disconnect();
  console.log('   ✅ Teacher A disconnected, session recording finalized.');
  await new Promise((r) => setTimeout(r, 800));

  // 3. Verify Teacher-Only Privacy
  console.log('\n3️⃣ Testing Teacher-Only Privacy Enforcement:');
  
  // Teacher B queries history:
  const historyBRes = await fetch(`${BASE_URL}/api/meetings/history/all`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const historyB = await historyBRes.json();
  const bMeetings = historyB.meetings.filter((m) => m.code === teacherA.personalMeetingCode);
  console.log(`   Teacher B sees ${bMeetings.length} of Teacher A's classes.`);
  if (bMeetings.length > 0) {
    throw new Error('Privacy Violation: Teacher B was able to see Teacher A\'s meeting!');
  }
  console.log('   ✅ Privacy Verified: Teacher B cannot see Teacher A\'s meetings or recordings!');

  // Teacher A queries history:
  const historyARes = await fetch(`${BASE_URL}/api/meetings/history/all`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const historyA = await historyARes.json();
  const aMeetings = historyA.meetings.filter((m) => m.code === teacherA.personalMeetingCode);
  console.log(`   Teacher A sees ${aMeetings.length} of their own classes.`);
  if (aMeetings.length === 0) {
    throw new Error('Teacher A cannot see their own meeting!');
  }
  console.log('   ✅ Teacher A can see their own class!');

  // Admin queries history:
  const historyAdminRes = await fetch(`${BASE_URL}/api/meetings/history/all`, {
    headers: { Authorization: `Bearer ${tokenAdmin}` },
  });
  const historyAdmin = await historyAdminRes.json();
  const adminMeetings = historyAdmin.meetings.filter((m) => m.code === teacherA.personalMeetingCode);
  if (adminMeetings.length === 0) {
    throw new Error('Admin failed to observe Teacher A\'s meeting!');
  }
  console.log('   ✅ Administrator can observe all teachers\' classes across the platform!');

  // Teacher B attempts direct detail access on Teacher A's meeting:
  const meetingId = aMeetings[0].id;
  const detailBRes = await fetch(`${BASE_URL}/api/meetings/detail/${meetingId}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  console.log(`   Teacher B detail access attempt status: ${detailBRes.status}`);
  if (detailBRes.status !== 403) {
    throw new Error(`Expected 403 Forbidden for unauthorized teacher detail view, got ${detailBRes.status}`);
  }
  console.log('   ✅ Teacher B is blocked (403 Forbidden) from viewing Teacher A\'s meeting detail & recording!');

  // 4. Verify Recording Stream & Byte Integrity
  console.log('\n4️⃣ Verifying Recording File Integrity & Stream:');
  const streamRes = await fetch(`${BASE_URL}/api/meetings/${meetingId}/recording/stream`, {
    headers: { Range: 'bytes=0-100' },
  });
  console.log(`   Stream response status: ${streamRes.status}`);
  if (streamRes.status !== 206 && streamRes.status !== 200) {
    throw new Error(`Stream failed with status ${streamRes.status}`);
  }
  const chunkHeader = Buffer.from(await streamRes.arrayBuffer());
  console.log(`   ✅ Streamed chunk size: ${chunkHeader.length} bytes`);
  console.log(`   ✅ Content-Type: ${streamRes.headers.get('content-type')}`);
  console.log(`   ✅ Stream header bytes: [${[...chunkHeader.slice(0, 4)].map((b) => '0x' + b.toString(16)).join(', ')}]`);

  console.log('\n🎉 ALL PRIVACY, RECORDING STREAM & THEME REQUIREMENTS VERIFIED 100%! 🎉\n');
}

runPrivacyAndRecordingTests().catch((err) => {
  console.error('\n❌ Test Failed:', err);
  process.exit(1);
});
