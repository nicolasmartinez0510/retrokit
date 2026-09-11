const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const templates = [
  {
    oldNames: ['Start / Stop / Continue'],
    name: 'Empezar / Parar / Continuar',
    description:
      'Identificá hábitos nuevos, prácticas a dejar y lo que conviene mantener.',
    columns: [
      {
        title: 'Empezar',
        description: '¿Qué deberíamos empezar a hacer como equipo?',
        icon: '▶',
        position: 0,
      },
      {
        title: 'Parar',
        description: '¿Qué nos está frenando y deberíamos dejar de hacer?',
        icon: '■',
        position: 1,
      },
      {
        title: 'Continuar',
        description: '¿Qué está funcionando bien y queremos seguir haciendo?',
        icon: '↻',
        position: 2,
      },
    ],
  },
  {
    oldNames: ['4Ls'],
    name: 'Las 4 L',
    description:
      'Reflexioná sobre lo que te gustó, aprendiste, faltó y anhelaste en el período.',
    columns: [
      {
        title: 'Me gustó',
        description: '¿Qué te gustó o celebrás de este período?',
        icon: '♥',
        position: 0,
      },
      {
        title: 'Aprendí',
        description: '¿Qué aprendiste vos o el equipo?',
        icon: '★',
        position: 1,
      },
      {
        title: 'Faltó',
        description: '¿Qué faltó o se sintió incompleto?',
        icon: '○',
        position: 2,
      },
      {
        title: 'Anhelé',
        description: '¿Qué te hubiera gustado tener o vivir?',
        icon: '◇',
        position: 3,
      },
    ],
  },
  {
    oldNames: ['Mad / Sad / Glad'],
    name: 'Enojado / Triste / Contento',
    description: 'Expresá cómo te sentiste durante el sprint o la iniciativa.',
    columns: [
      {
        title: 'Enojado',
        description: '¿Qué te generó frustración o enojo?',
        icon: '!',
        position: 0,
      },
      {
        title: 'Triste',
        description: '¿Qué te decepcionó o te puso triste?',
        icon: '·',
        position: 1,
      },
      {
        title: 'Contento',
        description: '¿Qué te alegró o te hizo sentir orgulloso?',
        icon: '+',
        position: 2,
      },
    ],
  },
  {
    oldNames: ['Keep / Drop / Start'],
    name: 'Mantener / Descartar / Empezar',
    description:
      'Definí qué conservar, qué abandonar y qué incorporar en el próximo ciclo.',
    columns: [
      {
        title: 'Mantener',
        description: '¿Qué prácticas o hábitos debemos mantener?',
        icon: '✓',
        position: 0,
      },
      {
        title: 'Descartar',
        description: '¿Qué debemos dejar de hacer de inmediato?',
        icon: '✗',
        position: 1,
      },
      {
        title: 'Empezar',
        description: '¿Qué nuevas prácticas deberíamos adoptar?',
        icon: '▶',
        position: 2,
      },
    ],
  },
  {
    oldNames: ['Went Well / To Improve / Ideas'],
    name: 'Salió bien / A mejorar / Ideas',
    description:
      'Clásico de mejora continua: logros, oportunidades e ideas concretas.',
    columns: [
      {
        title: 'Salió bien',
        description: '¿Qué salió bien y queremos repetir?',
        icon: '↑',
        position: 0,
      },
      {
        title: 'A mejorar',
        description: '¿Qué podemos mejorar en el próximo ciclo?',
        icon: '↓',
        position: 1,
      },
      {
        title: 'Ideas',
        description: '¿Qué ideas nuevas proponés para el equipo?',
        icon: '✦',
        position: 2,
      },
    ],
  },
];

async function upsertTemplate(t) {
  let row = await prisma.template.findFirst({ where: { name: t.name } });
  if (!row) {
    for (const oldName of t.oldNames || []) {
      row = await prisma.template.findFirst({ where: { name: oldName } });
      if (row) break;
    }
  }

  if (row) {
    await prisma.template.update({
      where: { id: row.id },
      data: { name: t.name, description: t.description },
    });
    const cols = await prisma.templateColumn.findMany({
      where: { templateId: row.id },
      orderBy: { position: 'asc' },
    });
    for (let i = 0; i < t.columns.length; i++) {
      const col = t.columns[i];
      if (cols[i]) {
        await prisma.templateColumn.update({
          where: { id: cols[i].id },
          data: {
            title: col.title,
            description: col.description,
            icon: col.icon,
            position: col.position,
          },
        });
      } else {
        await prisma.templateColumn.create({
          data: { templateId: row.id, ...col },
        });
      }
    }
    console.log(`Updated template: ${t.name}`);
  } else {
    await prisma.template.create({
      data: {
        name: t.name,
        description: t.description,
        maxCommentsPerParticipant: 3,
        votesPerParticipant: 5,
        maxVotesPerCard: 2,
        columns: { create: t.columns },
      },
    });
    console.log(`Seeded template: ${t.name}`);
  }
}

async function main() {
  for (const t of templates) {
    await upsertTemplate(t);
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
