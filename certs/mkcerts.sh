#!/bin/sh

set -eu
export LC_ALL='C'

# export LD_PRELOAD='/usr/lib/faketime/libfaketime.so.1'
# export FAKETIME='1970-01-01 00:00:00'

CERTS_DIR="$(CDPATH='' cd -- "$(dirname -- "${0:?}")" && pwd -P)"

mkdir -p "${CERTS_DIR:?}"/ca/
CA_KEY="${CERTS_DIR:?}"/ca/key.pem
CA_SRL="${CERTS_DIR:?}"/ca/cert.srl
CA_CRT="${CERTS_DIR:?}"/ca/cert.pem
CA_CRT_CN='demergi'
CA_CRT_VALIDITY_DAYS='7300'
CA_CRT_RENOVATION_DAYS='365'

mkdir -p "${CERTS_DIR:?}"/server/
SERVER_KEY="${CERTS_DIR:?}"/server/key.pem
SERVER_CSR="${CERTS_DIR:?}"/server/csr.pem
SERVER_CRT="${CERTS_DIR:?}"/server/cert.pem
SERVER_CRT_OPENSSL_CNF="${CERTS_DIR:?}"/server/openssl.cnf
SERVER_CRT_CN='demergi'
SERVER_CRT_VALIDITY_DAYS='730'
SERVER_CRT_RENOVATION_DAYS='30'

mkdir -p "${CERTS_DIR:?}"/client/
CLIENT_KEY="${CERTS_DIR:?}"/client/key.pem
CLIENT_CSR="${CERTS_DIR:?}"/client/csr.pem
CLIENT_CRT="${CERTS_DIR:?}"/client/cert.pem
CLIENT_CRT_OPENSSL_CNF="${CERTS_DIR:?}"/client/openssl.cnf
CLIENT_CRT_CN='demergi'
CLIENT_CRT_VALIDITY_DAYS='730'
CLIENT_CRT_RENOVATION_DAYS='30'

# Generate CA private key if it does not exist
if [ ! -e "${CA_KEY:?}" ] \
	|| ! openssl ecparam -check -in "${CA_KEY:?}" -noout >/dev/null 2>&1
then
	printf '%s\n' 'Generating CA private key...'
	openssl ecparam -genkey -name prime256v1 -out "${CA_KEY:?}"
	rm -f "${CA_CRT:?}"
fi

# Generate CA certificate if it does not exist or will expire soon
if [ ! -e "${CA_CRT:?}" ] \
	|| ! openssl x509 -checkend "$((60*60*24*CA_CRT_RENOVATION_DAYS))" -in "${CA_CRT:?}" -noout >/dev/null 2>&1
then
	printf '%s\n' 'Generating CA certificate...'
	openssl req -new \
		-key "${CA_KEY:?}" \
		-out "${CA_CRT:?}" \
		-subj "/CN=${CA_CRT_CN:?}:CA" \
		-x509 \
		-days "${CA_CRT_VALIDITY_DAYS:?}"
	rm -f "${SERVER_CRT:?}"
fi

# Generate server private key if it does not exist
if [ ! -e "${SERVER_KEY:?}" ] \
	|| ! openssl ecparam -check -in "${SERVER_KEY:?}" -noout >/dev/null 2>&1
then
	printf '%s\n' 'Generating server private key...'
	openssl ecparam -genkey -name prime256v1 -out "${SERVER_KEY:?}"
	rm -f "${SERVER_CRT:?}"
fi

# Generate server certificate if it does not exist or will expire soon
if [ ! -e "${SERVER_CRT:?}" ] \
	|| ! openssl verify -CAfile "${CA_CRT:?}" "${SERVER_CRT:?}" >/dev/null 2>&1 \
	|| ! openssl x509 -checkend "$((60*60*24*SERVER_CRT_RENOVATION_DAYS))" -in "${SERVER_CRT:?}" -noout >/dev/null 2>&1
then
	printf '%s\n' 'Generating server certificate...'
	openssl req -new \
		-key "${SERVER_KEY:?}" \
		-out "${SERVER_CSR:?}" \
		-subj "/CN=${SERVER_CRT_CN:?}:Server"
	cat > "${SERVER_CRT_OPENSSL_CNF:?}" <<-EOF
		[ x509_exts ]
		subjectAltName = DNS:${SERVER_CRT_CN:?},DNS:localhost,IP:127.0.0.1,IP:::1
	EOF
	openssl x509 -req \
		-in "${SERVER_CSR:?}" \
		-out "${SERVER_CRT:?}" \
		-CA "${CA_CRT:?}" \
		-CAkey "${CA_KEY:?}" \
		-CAserial "${CA_SRL:?}" -CAcreateserial \
		-days "${SERVER_CRT_VALIDITY_DAYS:?}" \
		-extfile "${SERVER_CRT_OPENSSL_CNF:?}" \
		-extensions x509_exts \
		2>/dev/null
	cat "${CA_CRT:?}" >> "${SERVER_CRT:?}"
	openssl x509 -in "${SERVER_CRT:?}" -fingerprint -noout
fi

# Generate client private key if it does not exist
if [ ! -e "${CLIENT_KEY:?}" ] \
	|| ! openssl ecparam -check -in "${CLIENT_KEY:?}" -noout >/dev/null 2>&1
then
	printf '%s\n' 'Generating client private key...'
	openssl ecparam -genkey -name prime256v1 -out "${CLIENT_KEY:?}"
	rm -f "${CLIENT_CRT:?}"
fi

# Generate client certificate if it does not exist or will expire soon
if [ ! -e "${CLIENT_CRT:?}" ] \
	|| ! openssl verify -CAfile "${CA_CRT:?}" "${CLIENT_CRT:?}" >/dev/null 2>&1 \
	|| ! openssl x509 -checkend "$((60*60*24*CLIENT_CRT_RENOVATION_DAYS))" -in "${CLIENT_CRT:?}" -noout >/dev/null 2>&1
then
	printf '%s\n' 'Generating client certificate...'
	openssl req -new \
		-key "${CLIENT_KEY:?}" \
		-out "${CLIENT_CSR:?}" \
		-subj "/CN=${CLIENT_CRT_CN:?}:Client"
	cat > "${CLIENT_CRT_OPENSSL_CNF:?}" <<-EOF
		[ x509_exts ]
		subjectAltName = DNS:${CLIENT_CRT_CN:?},DNS:localhost,IP:127.0.0.1,IP:::1
	EOF
	openssl x509 -req \
		-in "${CLIENT_CSR:?}" \
		-out "${CLIENT_CRT:?}" \
		-CA "${CA_CRT:?}" \
		-CAkey "${CA_KEY:?}" \
		-CAserial "${CA_SRL:?}" -CAcreateserial \
		-days "${CLIENT_CRT_VALIDITY_DAYS:?}" \
		-extfile "${CLIENT_CRT_OPENSSL_CNF:?}" \
		-extensions x509_exts \
		2>/dev/null
	cat "${CA_CRT:?}" >> "${CLIENT_CRT:?}"
	openssl x509 -in "${CLIENT_CRT:?}" -fingerprint -noout
fi
