#!/usr/bin/env node
/**
 * Demo data seed: wipes all emmasenvy table data, then inserts fresh demo rows.
 * Prerequisite: npm run db:setup (schema must exist)
 * Usage: npm run db:seed-demo
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const { SALT_ROUNDS, DEFAULT_CURRENCY, POINTS_PER_DOLLAR } = require('../lib/constants');
const { getHandlerTeamForIssue } = require('../lib/supportTicketConfig');

const DEMO_PASSWORD = 'Demo1234!';
const SCHEMA = 'emmasenvy';

const TRUNCATE_TABLES = [
  'support_ticket_attachments',
  'support_ticket_messages',
  'support_tickets',
  'newsletters',
  'portfolio_photos',
  'appointments',
  'invoices',
  'promo_codes',
  'reward_offerings',
  'service_type',
  'portfolios',
  'user_sessions',
  'users',
  'site_settings',
];

const root = path.join(__dirname, '..', '..');
const demoAssets = path.join(root, 'DemoAssets');
const uploadsRoot = path.join(__dirname, '..', 'uploads');

const NAIL_IMAGE_REGEX = /\.(png|jpe?g|gif|webp)$/i;

/** All nail images under DemoAssets/Nails (portfolio uses the full set). */
function listNailAssetFiles() {
  const nailsDir = path.join(demoAssets, 'Nails');
  if (!fs.existsSync(nailsDir)) {
    throw new Error(`DemoAssets/Nails folder not found: ${nailsDir}`);
  }
  const files = fs
    .readdirSync(nailsDir)
    .filter((f) => NAIL_IMAGE_REGEX.test(f))
    .sort((a, b) => a.localeCompare(b));
  if (files.length === 0) {
    throw new Error('DemoAssets/Nails has no image files');
  }
  return files;
}

const USERS = [
  {
    email: 'emma@fake.com',
    phone: '1111111111',
    first_name: 'Emma',
    last_name: 'Envy',
    role: 'admin',
    dob: '1990-04-12',
    reward_points: 0,
    profileSrc: 'ProfilePhotos/Emma.jpg',
    profileDest: 'seed-emma.jpg',
  },
  {
    email: 'demo1@fake.com',
    phone: '2222222222',
    first_name: 'Maya',
    last_name: 'Brooks',
    role: 'customer',
    dob: '1998-07-22',
    reward_points: 120,
    profileSrc: 'ProfilePhotos/Customer1.png',
    profileDest: 'seed-maya.png',
  },
  {
    email: 'demo2@fake.com',
    phone: '3333333333',
    first_name: 'Zuri',
    last_name: 'Coleman',
    role: 'customer',
    dob: '1999-11-03',
    reward_points: 340,
    profileSrc: 'ProfilePhotos/Customer2.png',
    profileDest: 'seed-zuri.png',
  },
  {
    email: 'demo3@fake.com',
    phone: '4444444444',
    first_name: 'Victoria',
    last_name: 'Hayes',
    role: 'customer',
    dob: '1995-02-18',
    reward_points: 85,
    profileSrc: 'ProfilePhotos/Customer3.png',
    profileDest: 'seed-victoria.png',
  },
  {
    email: 'demo4@fake.com',
    phone: '5555555555',
    first_name: 'Elena',
    last_name: 'Martinez',
    role: 'customer',
    dob: '2000-09-30',
    reward_points: 510,
    profileSrc: 'ProfilePhotos/Customer4.png',
    profileDest: 'seed-elena.png',
  },
  {
    email: 'demo5@fake.com',
    phone: '6666666666',
    first_name: 'Nia',
    last_name: 'Patel',
    role: 'it',
    dob: '1992-06-15',
    reward_points: 0,
    profileSrc: 'ProfilePhotos/IT.png',
    profileDest: 'seed-nia.png',
  },
];

const SERVICES = [
  {
    title: 'Classic Gel Manicure',
    description: 'Shape, cuticle care, gel polish, and a nourishing finish.',
    duration: '45 minutes',
    price: 45,
    tags: ['gel', 'manicure'],
  },
  {
    title: 'Luxe Acrylic Full Set',
    description: 'Custom-length acrylic extensions with your choice of finish.',
    duration: '90 minutes',
    price: 75,
    tags: ['acrylic', 'full-set'],
  },
  {
    title: 'Gel-X Extensions',
    description: 'Lightweight soft-gel extensions for a natural, durable look.',
    duration: '75 minutes',
    price: 85,
    tags: ['gel-x', 'extensions'],
  },
  {
    title: 'Custom Nail Art',
    description: 'Hand-painted designs, foils, gems, and bespoke detailing.',
    duration: '60 minutes',
    price: 65,
    tags: ['nail-art', 'design'],
  },
  {
    title: 'Spa Pedicure',
    description: 'Soak, exfoliation, massage, and long-wear polish.',
    duration: '60 minutes',
    price: 55,
    tags: ['pedicure', 'spa'],
  },
  {
    title: 'Polish Change & Repair',
    description: 'Quick refresh or fix for chips, breaks, and wear.',
    duration: '30 minutes',
    price: 25,
    tags: ['repair', 'maintenance'],
  },
];

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function daysFromNow(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function addMonths(dateStr, months) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function captionFromFilename(filename) {
  const base = filename.replace(/\.[^.]+$/, '');
  const parts = base.split('_');
  if (parts.length >= 2) {
    const style = parts[0].replace(/([a-z])([A-Z])/g, '$1 $2');
    const color = parts[1]
      .replace(/^Color/, '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim();
    return `${style} — ${color}`;
  }
  return base.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function generateInvoiceId(clientName, dateStr) {
  const name = (clientName || 'GU').trim().toUpperCase();
  const parts = name.split(/\s+/).filter(Boolean);
  const first = (parts[0] || 'G').charAt(0);
  const second = parts.length > 1 ? parts[1].charAt(0) : parts[0].length > 1 ? parts[0].charAt(1) : 'U';
  const datePart = (dateStr || '').replace(/-/g, '').slice(0, 8) || '00000000';
  return `${first}${second}${datePart}`;
}

function copyAsset(srcRelative, subdir, destBasename) {
  const src = path.join(demoAssets, srcRelative);
  if (!fs.existsSync(src)) {
    throw new Error(`Demo asset not found: ${src}`);
  }
  const destDir = path.join(uploadsRoot, subdir);
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, destBasename);
  fs.copyFileSync(src, dest);
  return `${subdir}/${destBasename}`.replace(/\\/g, '/');
}

function copyNailAsset(nailFilename, subdir, destBasename) {
  return copyAsset(path.join('Nails', nailFilename), subdir, destBasename);
}

function mimeFromUploadPath(relPath) {
  const ext = path.extname(relPath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function pickAt(list, index) {
  if (!list.length) return null;
  return list[index % list.length];
}

function pickSlice(list, start, count) {
  if (!list.length || count <= 0) return [];
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push(list[(start + i) % list.length]);
  }
  return out;
}

function hoursAgo(n) {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d;
}

function daysAgoAt(n, hour = 10) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

function copyAllAssets() {
  const nailFiles = listNailAssetFiles();
  const paths = {};
  paths.emmaProfile = copyAsset('ProfilePhotos/Emma.jpg', 'profile_photos', 'seed-emma.jpg');
  paths.heroImage = copyAsset('ProfilePhotos/Emma.jpg', 'home_hero', 'seed-hero-emma.jpg');

  for (const u of USERS) {
    if (u.email === 'emma@fake.com') continue;
    const rel = copyAsset(u.profileSrc, 'profile_photos', u.profileDest);
    paths[u.email] = rel;
  }

  paths.portfolio = nailFiles.map((file) => {
    const destName = `seed-${file}`;
    const rel = copyNailAsset(file, 'portfolio', destName);
    return { url: rel, caption: captionFromFilename(file) };
  });

  paths.inspo = nailFiles.map((file, i) =>
    copyNailAsset(file, path.join('appointments', 'inspo'), `seed-inspo-${i + 1}-${file}`)
  );

  paths.completed = nailFiles.map((file, i) =>
    copyNailAsset(file, path.join('appointments', 'completedapt'), `seed-completed-${i + 1}-${file}`)
  );

  paths.support = nailFiles.map((file, i) =>
    copyNailAsset(file, 'support', `seed-support-${i + 1}-${file}`)
  );

  return paths;
}

async function truncateAllData(client) {
  const tableList = TRUNCATE_TABLES.map((t) => `${SCHEMA}.${t}`).join(', ');
  await client.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
}

async function insertUser(client, user, passwordHash, profilePath) {
  const now = new Date();
  const r = await client.query(
    `INSERT INTO ${SCHEMA}.users (
      first_name, last_name, dob, phone, profile_picture, email, password, role,
      two_factor_enabled, status, reward_points, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, 'active', $9, $10, $10)
    RETURNING id`,
    [
      user.first_name,
      user.last_name,
      user.dob,
      user.phone,
      profilePath,
      user.email,
      passwordHash,
      user.role,
      user.reward_points,
      now,
    ]
  );
  return r.rows[0].id;
}

async function insertService(client, employeeId, svc) {
  const now = new Date();
  const r = await client.query(
    `INSERT INTO ${SCHEMA}.service_type (
      employee_id, title, description, duration_needed, price, tags, created_at, updated_at
    ) VALUES ($1, $2, $3, $4::interval, $5, $6, $7, $7)
    RETURNING id, title, price`,
    [employeeId, svc.title, svc.description, svc.duration, svc.price, svc.tags, now]
  );
  return r.rows[0];
}

async function insertAppointmentInvoice(client, opts) {
  const {
    clientId,
    clientName,
    clientEmail,
    clientPhone,
    employeeId,
    createdBy,
    date,
    time,
    duration,
    serviceTypeId,
    serviceTitle,
    price,
    status,
    paymentStatus,
    paymentMethod,
    workflow,
    inspoPics,
    completedPhotos,
    rewardPointsUsed,
    pointsAwarded,
    promoCodeId,
    invoiceSuffix,
  } = opts;

  const now = new Date();
  const appRes = await client.query(
    `INSERT INTO ${SCHEMA}.appointments (
      client_id, client_name, client_email, client_phone, employee_id, date, time,
      description, inspo_pics, status, created_by, created_at, updated_at, duration, service_type_id,
      confirmed_at, checked_in_at, in_progress_at, completed_at, paid_at, completed_photos
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $12, $13::interval, $14,
      $15, $16, $17, $18, $19, $20
    ) RETURNING id`,
    [
      clientId,
      clientName,
      clientEmail,
      clientPhone,
      employeeId,
      date,
      time,
      `Demo appointment — ${serviceTitle}`,
      inspoPics ?? [],
      status,
      createdBy,
      now,
      duration,
      serviceTypeId,
      workflow?.confirmed_at ?? null,
      workflow?.checked_in_at ?? null,
      workflow?.in_progress_at ?? null,
      workflow?.completed_at ?? null,
      workflow?.paid_at ?? null,
      completedPhotos ?? [],
    ]
  );
  const appointmentId = appRes.rows[0].id;
  const prefix = generateInvoiceId(clientName, date);
  const humanInvoiceId = `${prefix}-${invoiceSuffix}`;

  const invRes = await client.query(
    `INSERT INTO ${SCHEMA}.invoices (
      invoice_id, customer_id, name, email, phone, created_by, total_amount, currency,
      payment_status, payment_method, created_at, updated_at, appointment_id, service_title,
      reward_points_used, points_awarded, amount_received
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12, $13, $14, $15, $16)
    RETURNING id`,
    [
      humanInvoiceId,
      clientId,
      clientName,
      clientEmail,
      clientPhone,
      createdBy,
      price,
      DEFAULT_CURRENCY,
      paymentStatus,
      paymentMethod,
      now,
      appointmentId,
      serviceTitle,
      rewardPointsUsed ?? null,
      pointsAwarded ?? null,
      paymentStatus === 'Paid' ? price : null,
    ]
  );
  const invoiceId = invRes.rows[0].id;
  await client.query(`UPDATE ${SCHEMA}.appointments SET invoice_id = $1, updated_at = $2 WHERE id = $3`, [
    invoiceId,
    now,
    appointmentId,
  ]);

  if (promoCodeId != null) {
    await client.query(
      `UPDATE ${SCHEMA}.promo_codes SET current_usage_count = current_usage_count + 1 WHERE id = $1`,
      [promoCodeId]
    );
    await client.query(
      `UPDATE ${SCHEMA}.users
       SET used_promo_codes = array_append(COALESCE(used_promo_codes, ARRAY[]::integer[]), $1::integer)
       WHERE id = $2`,
      [promoCodeId, clientId]
    );
  }

  return { appointmentId, invoiceId };
}

function workflowForPaidDay(dateStr, timeStr) {
  const base = new Date(`${dateStr}T${timeStr}:00`);
  const confirmed = new Date(base);
  confirmed.setMinutes(confirmed.getMinutes() - 60);
  const checkedIn = new Date(base);
  checkedIn.setMinutes(checkedIn.getMinutes() - 10);
  const inProgress = new Date(base);
  const completed = new Date(base);
  completed.setMinutes(completed.getMinutes() + 75);
  const paid = new Date(completed);
  paid.setMinutes(paid.getMinutes() + 15);
  return {
    confirmed_at: confirmed,
    checked_in_at: checkedIn,
    in_progress_at: inProgress,
    completed_at: completed,
    paid_at: paid,
  };
}

async function seedCustomerAppointments(client, customer, customerIndex, emmaId, services, promoWelcomeId, assetPaths) {
  const name = `${customer.first_name} ${customer.last_name}`;
  const serviceIdx = [0, 2, 3, 1];
  const times = ['10:00', '13:30', '11:00', '15:00'];
  const offset = customerIndex * 2;
  const created = [];

  const appt1Svc = services[serviceIdx[0]];
  created.push(
    await insertAppointmentInvoice(client, {
      clientId: customer.id,
      clientName: name,
      clientEmail: customer.email,
      clientPhone: customer.phone,
      employeeId: emmaId,
      createdBy: emmaId,
      date: daysAgo(42),
      time: times[0],
      duration: '45 minutes',
      serviceTypeId: appt1Svc.id,
      serviceTitle: appt1Svc.title,
      price: Number(appt1Svc.price),
      status: 'Paid',
      paymentStatus: 'Paid',
      paymentMethod: 'card',
      workflow: workflowForPaidDay(daysAgo(42), times[0]),
      inspoPics: pickSlice(assetPaths.inspo, offset, 2),
      completedPhotos: pickSlice(assetPaths.completed, offset, 2),
      pointsAwarded: Math.floor(Number(appt1Svc.price) * POINTS_PER_DOLLAR),
      invoiceSuffix: 1,
    })
  );

  const appt2Svc = services[serviceIdx[1]];
  const usePromo = customer.email === 'demo1@fake.com';
  created.push(
    await insertAppointmentInvoice(client, {
      clientId: customer.id,
      clientName: name,
      clientEmail: customer.email,
      clientPhone: customer.phone,
      employeeId: emmaId,
      createdBy: emmaId,
      date: daysAgo(21),
      time: times[1],
      duration: '75 minutes',
      serviceTypeId: appt2Svc.id,
      serviceTitle: appt2Svc.title,
      price: Number(appt2Svc.price),
      status: 'Paid',
      paymentStatus: 'Paid',
      paymentMethod: 'cash',
      workflow: workflowForPaidDay(daysAgo(21), times[1]),
      inspoPics: pickSlice(assetPaths.inspo, offset + 2, 3),
      completedPhotos: pickSlice(assetPaths.completed, offset + 2, 2),
      pointsAwarded: Math.floor(Number(appt2Svc.price) * POINTS_PER_DOLLAR),
      promoCodeId: usePromo ? promoWelcomeId : null,
      invoiceSuffix: 2,
    })
  );

  const appt3Svc = services[serviceIdx[2]];
  const wf3 = workflowForPaidDay(daysAgo(7), times[2]);
  created.push(
    await insertAppointmentInvoice(client, {
      clientId: customer.id,
      clientName: name,
      clientEmail: customer.email,
      clientPhone: customer.phone,
      employeeId: emmaId,
      createdBy: emmaId,
      date: daysAgo(7),
      time: times[2],
      duration: '60 minutes',
      serviceTypeId: appt3Svc.id,
      serviceTitle: appt3Svc.title,
      price: Number(appt3Svc.price),
      status: 'Complete',
      paymentStatus: 'Pending',
      paymentMethod: 'pending',
      workflow: {
        confirmed_at: wf3.confirmed_at,
        checked_in_at: wf3.checked_in_at,
        in_progress_at: wf3.in_progress_at,
        completed_at: wf3.completed_at,
        paid_at: null,
      },
      inspoPics: pickSlice(assetPaths.inspo, offset + 4, 2),
      completedPhotos: pickSlice(assetPaths.completed, offset + 4, 3),
      invoiceSuffix: 3,
    })
  );

  const appt4Svc = services[serviceIdx[3]];
  const futureDay = daysFromNow(7 + customerIndex);
  const futureConfirmed = new Date(`${futureDay}T${times[3]}:00`);
  futureConfirmed.setHours(futureConfirmed.getHours() - 24);
  created.push(
    await insertAppointmentInvoice(client, {
      clientId: customer.id,
      clientName: name,
      clientEmail: customer.email,
      clientPhone: customer.phone,
      employeeId: emmaId,
      createdBy: customer.id,
      date: futureDay,
      time: times[3],
      duration: '90 minutes',
      serviceTypeId: appt4Svc.id,
      serviceTitle: appt4Svc.title,
      price: Number(appt4Svc.price),
      status: 'Confirmed',
      paymentStatus: 'Pending',
      paymentMethod: 'pending',
      workflow: { confirmed_at: futureConfirmed },
      inspoPics: pickSlice(assetPaths.inspo, offset + 1, 3),
      completedPhotos: [],
      invoiceSuffix: 4,
    })
  );

  return created.map((row, i) => ({
    ...row,
    status: ['Paid', 'Paid', 'Complete', 'Confirmed'][i],
    serviceTitle: [appt1Svc, appt2Svc, appt3Svc, appt4Svc][i].title,
  }));
}

async function insertSupportTicket(client, opts) {
  const {
    publicReference,
    userId,
    subject,
    issueType,
    handlerTeam = getHandlerTeamForIssue(issueType),
    linkedAppointmentId = null,
    linkedInvoiceId = null,
    status = 'pending_staff',
    assignedToUserId = null,
    priority = 'normal',
    resolvedAt = null,
    messages = [],
  } = opts;

  const lastMsgAt = messages.length ? messages[messages.length - 1].createdAt : new Date();
  const ticketRes = await client.query(
    `INSERT INTO ${SCHEMA}.support_tickets (
      public_reference, user_id, subject, issue_type, handler_team,
      linked_appointment_id, linked_invoice_id, status, priority, assigned_to_user_id,
      created_at, updated_at, resolved_at, last_message_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12, $13)
    RETURNING id`,
    [
      publicReference,
      userId,
      subject,
      issueType,
      handlerTeam,
      linkedAppointmentId,
      linkedInvoiceId,
      status,
      priority ?? 'normal',
      assignedToUserId,
      messages[0]?.createdAt ?? new Date(),
      resolvedAt,
      lastMsgAt,
    ]
  );
  const ticketId = ticketRes.rows[0].id;

  for (const msg of messages) {
    const msgRes = await client.query(
      `INSERT INTO ${SCHEMA}.support_ticket_messages (
        ticket_id, author_kind, author_user_id, body, is_internal, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        ticketId,
        msg.authorKind,
        msg.authorUserId ?? null,
        msg.body,
        msg.isInternal ?? false,
        msg.createdAt ?? new Date(),
      ]
    );
    const messageId = msgRes.rows[0].id;
    for (const filePath of msg.attachmentPaths || []) {
      await client.query(
        `INSERT INTO ${SCHEMA}.support_ticket_attachments (message_id, file_path, mime_type, created_at)
         VALUES ($1, $2, $3, $4)`,
        [messageId, filePath, mimeFromUploadPath(filePath), msg.createdAt ?? new Date()]
      );
    }
  }

  return ticketId;
}

async function seedSupportTickets(client, { userIds, emmaId, niaId, customerSeedData, assetPaths }) {
  const maya = customerSeedData.find((c) => c.customer.email === 'demo1@fake.com');
  const zuri = customerSeedData.find((c) => c.customer.email === 'demo2@fake.com');
  const victoria = customerSeedData.find((c) => c.customer.email === 'demo3@fake.com');
  const elena = customerSeedData.find((c) => c.customer.email === 'demo4@fake.com');

  const mayaFuture = maya.appointments[3];
  const elenaPaid = elena.appointments[0];
  const support = assetPaths.support;

  await insertSupportTicket(client, {
    publicReference: 'EE-DEMO1001',
    userId: maya.customer.id,
    subject: 'Inspiration photo not showing before my visit',
    issueType: 'photo_upload_display',
    linkedAppointmentId: mayaFuture.appointmentId,
    status: 'pending_staff',
    assignedToUserId: niaId,
    messages: [
      {
        authorKind: 'user',
        authorUserId: maya.customer.id,
        body: 'I attached this look for my upcoming appointment but it only shows a blank tile in the app. Can someone confirm you received it?',
        attachmentPaths: [pickAt(support, 0)],
        createdAt: hoursAgo(6),
      },
    ],
  });

  await insertSupportTicket(client, {
    publicReference: 'EE-DEMO1002',
    userId: zuri.customer.id,
    subject: 'Reschedule and match this nail design',
    issueType: 'appointment_change_policy',
    linkedAppointmentId: zuri.appointments[3].appointmentId,
    status: 'pending_customer',
    assignedToUserId: emmaId,
    messages: [
      {
        authorKind: 'user',
        authorUserId: zuri.customer.id,
        body: 'Could I move my appointment up one day and do something close to the set in this photo? Soft chrome with floral accents would be perfect.',
        attachmentPaths: [pickAt(support, 1), pickAt(support, 2)],
        createdAt: daysAgoAt(2, 14),
      },
      {
        authorKind: 'staff',
        authorUserId: emmaId,
        body: 'Absolutely — I moved you to the earlier slot and saved this inspo on your booking. Reply here if you want a different palette before you come in.',
        attachmentPaths: [pickAt(assetPaths.inspo, 2)],
        createdAt: daysAgoAt(2, 16),
      },
    ],
  });

  await insertSupportTicket(client, {
    publicReference: 'EE-DEMO1003',
    userId: victoria.customer.id,
    subject: 'Calendar shows the wrong day for my booking',
    issueType: 'booking_app_bug',
    linkedAppointmentId: victoria.appointments[3].appointmentId,
    status: 'open',
    assignedToUserId: niaId,
    priority: 'normal',
    messages: [
      {
        authorKind: 'user',
        authorUserId: victoria.customer.id,
        body: 'My confirmed appointment lists the right time but the wrong date in the appointments tab after I rescheduled last week.',
        createdAt: daysAgoAt(1, 9),
      },
      {
        authorKind: 'staff',
        authorUserId: niaId,
        body: 'Reproduced on iOS — checking timezone handling on appointment updates.',
        isInternal: true,
        createdAt: daysAgoAt(1, 10),
      },
    ],
  });

  await insertSupportTicket(client, {
    publicReference: 'EE-DEMO1004',
    userId: elena.customer.id,
    subject: 'How do I redeem reward points?',
    issueType: 'rewards_promo_newsletter',
    status: 'resolved',
    assignedToUserId: emmaId,
    resolvedAt: daysAgoAt(5, 17),
    messages: [
      {
        authorKind: 'user',
        authorUserId: elena.customer.id,
        body: 'I have 510 points — where do I apply them during checkout?',
        createdAt: daysAgoAt(6, 11),
      },
      {
        authorKind: 'staff',
        authorUserId: emmaId,
        body: 'Open POS checkout for your visit and tap “Apply rewards” before taking payment. I attached the reward tiers we currently offer.',
        attachmentPaths: [pickAt(support, 3)],
        createdAt: daysAgoAt(6, 13),
      },
      {
        authorKind: 'system',
        body: 'This ticket was marked resolved by staff. Reply here if you still need anything.',
        createdAt: daysAgoAt(5, 17),
      },
    ],
  });

  await insertSupportTicket(client, {
    publicReference: 'EE-DEMO1005',
    userId: elena.customer.id,
    subject: 'Receipt for my last visit',
    issueType: 'invoice_receipt_billing',
    linkedAppointmentId: elenaPaid.appointmentId,
    linkedInvoiceId: elenaPaid.invoiceId,
    status: 'pending_staff',
    messages: [
      {
        authorKind: 'user',
        authorUserId: elena.customer.id,
        body: 'Can you email a copy of the receipt from my gel manicure last month? I need it for an FSA claim.',
        createdAt: hoursAgo(18),
      },
    ],
  });

  await insertSupportTicket(client, {
    publicReference: 'EE-DEMO1006',
    userId: victoria.customer.id,
    subject: 'Do you offer this nail art for walk-ins?',
    issueType: 'service_pricing_menu',
    status: 'closed',
    assignedToUserId: emmaId,
    resolvedAt: daysAgoAt(10, 12),
    messages: [
      {
        authorKind: 'user',
        authorUserId: victoria.customer.id,
        body: 'Saw this design online — is it in your custom nail art tier and could someone do it this Saturday?',
        attachmentPaths: [pickAt(support, 4), pickAt(support, 5)],
        createdAt: daysAgoAt(12, 15),
      },
      {
        authorKind: 'staff',
        authorUserId: emmaId,
        body: 'Yes — that falls under Custom Nail Art ($65+). Saturday has a 2pm opening; book through the app or call the studio and mention ticket EE-DEMO1006.',
        createdAt: daysAgoAt(12, 17),
      },
      {
        authorKind: 'system',
        body: 'Staff closed this ticket.',
        createdAt: daysAgoAt(10, 12),
      },
    ],
  });
}

async function resetSequences(client) {
  const tables = [
    'users',
    'service_type',
    'promo_codes',
    'reward_offerings',
    'newsletters',
    'appointments',
    'invoices',
    'portfolio_photos',
  ];
  for (const table of tables) {
    await client.query(
      `SELECT setval(
         pg_get_serial_sequence('${SCHEMA}.${table}', 'id'),
         GREATEST(COALESCE((SELECT MAX(id) FROM ${SCHEMA}.${table}), 0), 1)
       )`
    );
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Copy backend/.env.example to backend/.env and configure it.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    console.log('Copying DemoAssets to backend/uploads...');
    const assetPaths = copyAllAssets();

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

    await client.query('BEGIN');

    console.log('Truncating all emmasenvy table data...');
    await truncateAllData(client);

    const userIds = {};
    for (const u of USERS) {
      const profilePath =
        u.email === 'emma@fake.com' ? assetPaths.emmaProfile : assetPaths[u.email];
      userIds[u.email] = await insertUser(client, u, passwordHash, profilePath);
    }
    const emmaId = userIds['emma@fake.com'];

    const customers = USERS.filter((u) => u.role === 'customer').map((u) => ({
      ...u,
      id: userIds[u.email],
    }));

    await client.query(
      `INSERT INTO ${SCHEMA}.site_settings (
        id, rewards_enabled, home_hero_image, hero_title, home_hero_material,
        policy_appointment_cancellation, policy_service_guarantee_fix,
        policy_shipping_fulfillment, policy_rewards_loyalty, policy_privacy, updated_at
      ) VALUES (1, true, $1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        assetPaths.heroImage,
        'Emmas Envy — Luxury Nails, Crafted for You',
        `Welcome to Emmas Envy, where every set is designed with precision, artistry, and care. From classic gel manicures to bespoke nail art, Emma brings runway-inspired finishes to your everyday look. Book your appointment today and discover why clients call this studio their happy place.`,
        'Cancel or reschedule at least 24 hours before your appointment. Late cancellations may incur a fee equal to 50% of the service price.',
        'We stand behind our work. If a gel or acrylic service chips within 7 days under normal wear, return for a complimentary fix on the affected nails.',
        'Retail polish and care kits ship within 3–5 business days via standard carrier. Tracking is emailed when your order leaves the studio.',
        'Earn 1 point per dollar on paid services. Redeem points for discounts and complimentary add-ons listed in the Rewards tab.',
        'We collect only the information needed to book appointments and process payments. We never sell your data to third parties.',
      ]
    );

    await client.query(
      `INSERT INTO ${SCHEMA}.portfolios (id, employee_id, description, visible, created_at, updated_at)
       VALUES (1, $1, $2, true, NOW(), NOW())`,
      [
        emmaId,
        'Emma is the founder of Emmas Envy, specializing in gel extensions, hand-painted nail art, and luxe finishes. With over a decade of experience, she blends editorial trends with wearable elegance.',
      ]
    );

    const now = new Date();
    for (let i = 0; i < assetPaths.portfolio.length; i++) {
      const p = assetPaths.portfolio[i];
      await client.query(
        `INSERT INTO ${SCHEMA}.portfolio_photos (portfolio_id, url, caption, sort_order, created_at, updated_at)
         VALUES (1, $1, $2, $3, $4, $4)`,
        [p.url, p.caption, i + 1, now]
      );
    }

    const services = [];
    for (const svc of SERVICES) {
      services.push(await insertService(client, emmaId, svc));
    }

    const nailArtServiceId = services.find((s) => s.title === 'Custom Nail Art').id;
    const repairServiceId = services.find((s) => s.title === 'Polish Change & Repair').id;

    const promoRes = await client.query(
      `INSERT INTO ${SCHEMA}.promo_codes (
        code, discount_type, discount_value, min_purchase_amount, expiration_date,
        usage_limit, current_usage_count, is_active, created_at, service_type_id
      ) VALUES
        ('WELCOME10', 'percentage', 10, 40, $1, NULL, 0, true, NOW(), NULL),
        ('SPRING25', 'flat_amount', 25, 70, $1, NULL, 0, true, NOW(), NULL),
        ('VELVET15', 'percentage', 15, 50, $1, NULL, 0, true, NOW(), $2),
        ('LOYAL50', 'flat_amount', 50, 100, $1, 50, 0, true, NOW(), NULL)
      RETURNING id, code`,
      [addMonths(now.toISOString().slice(0, 10), 6), nailArtServiceId]
    );
    const promoByCode = Object.fromEntries(promoRes.rows.map((r) => [r.code, r.id]));

    await client.query(
      `INSERT INTO ${SCHEMA}.reward_offerings (
        title, reward_type, point_cost, value, min_purchase_amount, is_active, service_type_id, created_at, updated_at
      ) VALUES
        ('10% Off Any Service', 'percent_off', 100, 10, NULL, true, NULL, NOW(), NOW()),
        ('$15 Loyalty Credit', 'dollar_off', 250, 15, 40, true, NULL, NOW(), NOW()),
        ('Free Polish Change', 'free_service', 500, NULL, NULL, true, $1, NOW(), NOW())`,
      [repairServiceId]
    );

    await client.query(
      `INSERT INTO ${SCHEMA}.newsletters (subject, content, promo_code_id, sent_at, created_by, created_at)
       VALUES ($1, $2, NULL, NULL, $3, NOW())`,
      [
        'Coming Soon: Spring Bloom Collection',
        'Our new seasonal palette drops next month — soft pastels, chrome accents, and floral micro-art. Stay tuned for early booking slots!',
        emmaId,
      ]
    );

    const sentAt = new Date();
    sentAt.setDate(sentAt.getDate() - 14);
    await client.query(
      `INSERT INTO ${SCHEMA}.newsletters (subject, content, promo_code_id, sent_at, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        'Welcome to Emmas Envy — 10% Off Your First Visit',
        'Use code WELCOME10 at checkout on your first appointment over $40. We cannot wait to see you in the chair!',
        promoByCode.WELCOME10,
        sentAt,
        emmaId,
      ]
    );

    const customerSeedData = [];
    for (let i = 0; i < customers.length; i += 1) {
      const customer = customers[i];
      const appointments = await seedCustomerAppointments(
        client,
        customer,
        i,
        emmaId,
        services,
        promoByCode.WELCOME10,
        assetPaths
      );
      customerSeedData.push({ customer, appointments });
    }

    console.log('Seeding support tickets with demo attachments...');
    await seedSupportTickets(client, {
      userIds,
      emmaId,
      niaId: userIds['demo5@fake.com'],
      customerSeedData,
      assetPaths,
    });

    await resetSequences(client);
    await client.query('COMMIT');

    console.log('\nDemo seed complete. Login with any account below (password: Demo1234!):\n');
    console.log('  Support demo tickets: EE-DEMO1001 … EE-DEMO1006 (customer and IT queues)\n');
    console.log('  Email              Phone        Role');
    console.log('  -----------------  -----------  --------');
    for (const u of USERS) {
      console.log(`  ${u.email.padEnd(18)} ${u.phone}  ${u.role}`);
    }
    console.log('');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Demo seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
