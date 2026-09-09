// This file is part of Retrokit.
//
// Copyright (C) 2026 Nicolas Martinez
//
// Retrokit is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Retrokit is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Retrokit.  If not, see <https://www.gnu.org/licenses/>.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const templates = [
  {
    name: 'Start / Stop / Continue',
    description: 'Decide what to start doing, stop doing, and continue doing.',
    columns: [
      { title: 'Start', icon: '🚀', position: 0 },
      { title: 'Stop', icon: '🛑', position: 1 },
      { title: 'Continue', icon: '✅', position: 2 },
    ],
  },
  {
    name: '4Ls',
    description: 'Liked, Learned, Lacked, Longed for.',
    columns: [
      { title: 'Liked', icon: '❤️', position: 0 },
      { title: 'Learned', icon: '📚', position: 1 },
      { title: 'Lacked', icon: '🔍', position: 2 },
      { title: 'Longed for', icon: '✨', position: 3 },
    ],
  },
  {
    name: 'Mad / Sad / Glad',
    description: 'Share what made you mad, sad, or glad.',
    columns: [
      { title: 'Mad', icon: '😠', position: 0 },
      { title: 'Sad', icon: '😢', position: 1 },
      { title: 'Glad', icon: '😊', position: 2 },
    ],
  },
  {
    name: 'Keep / Drop / Start',
    description: 'Keep what works, drop what does not, start something new.',
    columns: [
      { title: 'Keep', icon: '🔒', position: 0 },
      { title: 'Drop', icon: '🗑️', position: 1 },
      { title: 'Start', icon: '🌱', position: 2 },
    ],
  },
  {
    name: 'Went Well / To Improve / Ideas',
    description: 'Celebrate wins, surface improvements, and capture ideas.',
    columns: [
      { title: 'Went Well', icon: '👍', position: 0 },
      { title: 'To Improve', icon: '🔧', position: 1 },
      { title: 'Ideas', icon: '💡', position: 2 },
    ],
  },
];

async function main() {
  for (const t of templates) {
    const existing = await prisma.template.findFirst({ where: { name: t.name } });
    if (existing) {
      console.log(`Template already exists: ${t.name}`);
      continue;
    }
    const created = await prisma.template.create({
      data: {
        name: t.name,
        description: t.description,
        columns: { create: t.columns },
      },
      include: { columns: true },
    });
    console.log(`Seeded template: ${created.name} (${created.columns.length} columns)`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
