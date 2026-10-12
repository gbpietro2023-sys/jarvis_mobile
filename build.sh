#!/data/data/com.termux/files/usr/bin/bash
set -e

echo "=============================="
echo "   JARVIS - Build Helper"
echo "=============================="
echo ""
echo "Nota: este script NAO compila o Android localmente."
echo "A compilacao do APK acontece no GitHub Actions, apos o push."
echo ""

if [ ! -f "config.xml" ] || [ ! -d ".git" ]; then
    echo "Erro: este script deve ser executado dentro de ~/jarvis_mobile (raiz do projeto Git)."
    exit 1
fi

if ! command -v git >/dev/null 2>&1; then
    echo "Erro: git nao encontrado. Instale com: pkg install git"
    exit 1
fi

jaStaged=$(git diff --cached --name-only)
if [ -n "$jaStaged" ]; then
    echo "EXECUCAO INTERROMPIDA"
    echo "Ja existem arquivos preparados (staged) ANTES deste script rodar:"
    echo "$jaStaged"
    echo "Revise manualmente com: git diff --cached"
    echo "Para desfazer o staging: git restore --staged ."
    exit 1
fi

echo "--- Estado atual do repositorio ---"
git status
echo ""

if [ -z "$(git status --porcelain)" ]; then
    echo "Nenhuma alteracao detectada. Nada a fazer."
    exit 0
fi

echo "--- Arquivos detectados ---"
git status --short
echo ""

tmpStatus=$(mktemp)
if ! git status --porcelain -z > "$tmpStatus"; then
    echo "EXECUCAO INTERROMPIDA: falha ao ler git status."
    rm -f "$tmpStatus"
    exit 1
fi

caminhos=()
falhaParsing=0

while IFS= read -r -d '' entrada; do
    if [ ${#entrada} -lt 3 ]; then
        falhaParsing=1
        break
    fi
    statusCodigo="${entrada:0:2}"
    caminho="${entrada:3}"

    case "$statusCodigo" in
        R*|C*)
            # Renomeacao/copia staged nao deveria chegar aqui, pois ja
            # teria sido barrada pela checagem de staging pre-existente.
            # Por seguranca, interrompemos em vez de tentar interpretar.
            falhaParsing=1
            ;;
        *)
            caminhos+=("$caminho")
            ;;
    esac
done < "$tmpStatus"

rm -f "$tmpStatus"

if [ "$falhaParsing" -eq 1 ]; then
    echo "EXECUCAO INTERROMPIDA"
    echo "Foi detectada uma renomeacao/copia ou uma entrada que nao pode ser"
    echo "interpretada com seguranca. Revise manualmente com: git status"
    exit 1
fi

if [ ${#caminhos[@]} -eq 0 ]; then
    echo "EXECUCAO INTERROMPIDA: nenhum caminho valido foi identificado."
    exit 1
fi

padroesSensiveis="\.keystore$|\.jks$|\.env(\.[A-Za-z0-9_-]+)?$|secret|password|token|id_rsa|\.pem$"
sensiveisEncontrados=()
for arquivo in "${caminhos[@]}"; do
    if printf '%s\n' "$arquivo" | grep -qiE "$padroesSensiveis"; then
        sensiveisEncontrados+=("$arquivo")
    fi
done

if [ ${#sensiveisEncontrados[@]} -gt 0 ]; then
    echo "ALERTA: nomes de arquivo que parecem sensiveis foram encontrados:"
    for arquivo in "${sensiveisEncontrados[@]}"; do
        printf '  - %s\n' "$arquivo"
    done
    echo "Esta e apenas uma verificacao de NOME, nao de conteudo do arquivo."
    echo "EXECUCAO INTERROMPIDA para revisao manual."
    exit 1
fi

echo "--- Arquivos que serao preparados (apenas estes, nada mais) ---"
for arquivo in "${caminhos[@]}"; do
    printf '  - %s\n' "$arquivo"
done
echo ""
read -p "Deseja adicionar exatamente esses arquivos? (s/n): " confirmaAdd
if [ "$confirmaAdd" != "s" ] && [ "$confirmaAdd" != "S" ]; then
    echo "Operacao cancelada. Nenhuma alteracao foi feita."
    exit 0
fi

git add -A -- "${caminhos[@]}"

if git diff --cached --quiet; then
    echo "Nenhuma alteracao staged apos o add. Nada a commitar."
    exit 0
fi

echo ""
echo "--- Diff completo do que sera commitado ---"
git diff --cached
echo ""
echo "--- Resumo (arquivo por status) ---"
git diff --cached --name-status
echo ""

read -p "Confirma o conteudo acima e deseja prosseguir com o commit? (s/n): " confirmaCommit
if [ "$confirmaCommit" != "s" ] && [ "$confirmaCommit" != "S" ]; then
    echo "Operacao cancelada. Alteracoes continuam staged."
    echo "Para reverter: git restore --staged ."
    exit 0
fi

read -p "Mensagem do commit: " mensagemCommit
if [ -z "$mensagemCommit" ]; then
    echo "Erro: mensagem de commit nao pode ser vazia."
    exit 1
fi

git commit -m "$mensagemCommit"
echo ""
echo "Commit criado com sucesso."
echo ""

echo "--- Branch atual ---"
git branch --show-current
echo ""
read -p "Deseja enviar (git push) para o repositorio remoto agora? (s/n): " confirmaPush
if [ "$confirmaPush" != "s" ] && [ "$confirmaPush" != "S" ]; then
    echo "Push cancelado. Commit criado localmente, mas NAO enviado."
    echo "Para enviar depois: git push"
    exit 0
fi

if git push; then
    echo ""
    echo "Push concluido com sucesso!"
    echo "Verifique: https://github.com/gbpietro2023-sys/jarvis_mobile/actions"
else
    echo ""
    echo "Erro: o push falhou. Nenhuma alteracao foi perdida."
    exit 1
fi
