// Carregar técnicos
async function carregarTecnicos() {
  const res = await fetch('http://localhost:3000/tecnicos');
  const dados = await res.json();

  const tabela = document.getElementById('tabelaTecnicos');
  tabela.innerHTML = `
    <tr>
      <th>ID</th><th>Nome</th><th>Especialidade</th><th>Ações</th>
    </tr>
  `;

  dados.forEach(tecnico => {
    tabela.innerHTML += `
      <tr>
        <td>${tecnico.id}</td>
        <td>${tecnico.nome}</td>
        <td>${tecnico.especialidade}</td>
        <td>
          <button onclick="editarTecnico(${tecnico.id}, '${tecnico.nome}', '${tecnico.especialidade}')">Editar</button>
          <button onclick="removerTecnico(${tecnico.id})">Excluir</button>
        </td>
      </tr>
    `;
  });
}

// Cadastrar técnico
document.getElementById('formTecnico').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nome = document.getElementById('nome').value;
  const especialidade = document.getElementById('especialidade').value;

  await fetch('http://localhost:3000/tecnicos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome, especialidade })
  });

  carregarTecnicos();
});

// Editar técnico
async function editarTecnico(id, nomeAtual, especialidadeAtual) {
  const nome = prompt("Novo nome:", nomeAtual);
  const especialidade = prompt("Nova especialidade:", especialidadeAtual);

  await fetch(`http://localhost:3000/tecnicos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome, especialidade })
  });

  carregarTecnicos();
}

// Remover técnico
async function removerTecnico(id) {
  await fetch(`http://localhost:3000/tecnicos/${id}`, { method: 'DELETE' });
  carregarTecnicos();
}

// Inicializar
carregarTecnicos();
