async function carregarChamados() {
  const res = await fetch('http://localhost:3000/chamados');
  const dados = await res.json();

  const tabela = document.getElementById('tabelaChamados');
  tabela.innerHTML = `
    <tr>
      <th>ID</th><th>Problema</th><th>Status</th><th>Prioridade</th><th>Ações</th>
    </tr>
  `;

  dados.forEach(chamado => {
    tabela.innerHTML += `
      <tr>
        <td>${chamado.id}</td>
        <td>${chamado.problem}</td>
        <td>${chamado.status}</td>
        <td>${chamado.prioridade}</td>
        <td>
          <button onclick="abrirModalChamado(${chamado.id}, '${chamado.problem}', '${chamado.status}', '${chamado.prioridade}')">Editar</button>
          <button onclick="removerChamado(${chamado.id})">Excluir</button>
        </td>
      </tr>
    `;
  });
}

document.getElementById('formChamado').addEventListener('submit', async (e) => {
  e.preventDefault();
  const problem = document.getElementById('problem').value;
  const status = document.getElementById('status').value;
  const prioridade = document.getElementById('prioridade').value;

  await fetch('http://localhost:3000/chamados', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ problem, status, prioridade })
  });

  carregarChamados();
});

function abrirModalChamado(id, problem, status, prioridade) {
  document.getElementById('modalEdicao').style.display = 'block';
  document.getElementById('modalTitulo').innerText = "Editar Chamado";
  document.getElementById('editId').value = id;
  document.getElementById('camposEdicao').innerHTML = `
    <label>Problema:</label>
    <input type="text" id="editProblem" value="${problem}">
    <label>Status:</label>
    <input type="text" id="editStatus" value="${status}">
    <label>Prioridade:</label>
    <input type="text" id="editPrioridade" value="${prioridade}">
  `;
}

document.getElementById('formEdicao').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('editId').value;
  const problem = document.getElementById('editProblem')?.value;
  const status = document.getElementById('editStatus')?.value;
  const prioridade = document.getElementById('editPrioridade')?.value;

  await fetch(`http://localhost:3000/chamados/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ problem, status, prioridade })
  });

  document.getElementById('modalEdicao').style.display = 'none';
  carregarChamados();
});

document.getElementById('fecharModal').onclick = () => {
  document.getElementById('modalEdicao').style.display = 'none';
};

async function removerChamado(id) {
  await fetch(`http://localhost:3000/chamados/${id}`, { method: 'DELETE' });
  carregarChamados();
}

carregarChamados();
