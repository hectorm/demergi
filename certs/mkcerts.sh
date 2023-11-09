#!/bin/sh

set -eu
export LC_ALL='C'

# export LD_PRELOAD='/usr/lib/faketime/libfaketime.so.1'
# export FAKETIME='1970-01-01 00:00:00'

{
	set -a

	CERTS_DIR="$(CDPATH='' cd -- "$(dirname -- "${0:?}")" && pwd -P)"

	CA_KEY="${CERTS_DIR:?}"/ca/key.pem
	CA_CSR="${CERTS_DIR:?}"/ca/csr.pem
	CA_SRL="${CERTS_DIR:?}"/ca/cert.srl
	CA_CRT="${CERTS_DIR:?}"/ca/cert.pem
	CA_CRT_CNF="${CERTS_DIR:?}"/ca/openssl.cnf
	CA_CRT_SUBJ='/CN=Demergi CA'
	CA_CRT_VALIDITY_DAYS='7300'
	CA_CRT_RENOVATION_DAYS='30'
	CA_RENEW_PREHOOK=''
	CA_RENEW_POSTHOOK=''

	SERVER_KEY="${CERTS_DIR:?}"/server/key.pem
	SERVER_CSR="${CERTS_DIR:?}"/server/csr.pem
	SERVER_CRT="${CERTS_DIR:?}"/server/cert.pem
	SERVER_CRT_CNF="${CERTS_DIR:?}"/server/openssl.cnf
	SERVER_CRT_CA="${CERTS_DIR:?}"/server/ca.pem
	SERVER_CRT_FULLCHAIN="${CERTS_DIR:?}"/server/fullchain.pem
	SERVER_CRT_SUBJ='/CN=Demergi server'
	SERVER_CRT_SAN=$(printf '%s\n' \
		"DNS:$(hostname -f)" \
		'DNS:demergi' \
		'DNS:localhost' \
		'IP:127.0.0.1' \
		'IP:::1' \
	| paste -sd, -)
	SERVER_CRT_VALIDITY_DAYS='7300'
	SERVER_CRT_RENOVATION_DAYS='30'
	SERVER_RENEW_PREHOOK=''
	SERVER_RENEW_POSTHOOK=''

	CLIENT_KEY="${CERTS_DIR:?}"/client/key.pem
	CLIENT_CSR="${CERTS_DIR:?}"/client/csr.pem
	CLIENT_CRT="${CERTS_DIR:?}"/client/cert.pem
	CLIENT_CRT_CNF="${CERTS_DIR:?}"/client/openssl.cnf
	CLIENT_CRT_CA="${CERTS_DIR:?}"/client/ca.pem
	CLIENT_CRT_FULLCHAIN="${CERTS_DIR:?}"/client/fullchain.pem
	CLIENT_CRT_SUBJ='/CN=Demergi client'
	CLIENT_CRT_VALIDITY_DAYS='7300'
	CLIENT_CRT_RENOVATION_DAYS='30'
	CLIENT_P12="${CERTS_DIR:?}"/client/cert.p12
	CLIENT_P12_PASS='changeit'
	CLIENT_RENEW_PREHOOK=''
	CLIENT_RENEW_POSTHOOK=''

	set +a
}

if [ ! -e "${CERTS_DIR:?}"/ca/ ]; then mkdir -p "${CERTS_DIR:?}"/ca/; fi
if [ ! -e "${CERTS_DIR:?}"/server/ ]; then mkdir -p "${CERTS_DIR:?}"/server/; fi
if [ ! -e "${CERTS_DIR:?}"/client/ ]; then mkdir -p "${CERTS_DIR:?}"/client/; fi

# Generate CA private key if it does not exist
if [ ! -e "${CA_KEY:?}" ] \
	|| ! openssl ecparam -check -in "${CA_KEY:?}" -noout >/dev/null 2>&1
then
	printf '%s\n' 'Generating CA private key...'
	openssl ecparam -genkey -name prime256v1 -out "${CA_KEY:?}"
fi

# Generate CA certificate if it does not exist or will expire soon
if [ ! -e "${CA_CRT:?}" ] \
	|| [ "$(openssl x509 -pubkey -in "${CA_CRT:?}" -noout 2>/dev/null)" != "$(openssl pkey -pubout -in "${CA_KEY:?}" -outform PEM 2>/dev/null)" ] \
	|| ! openssl x509 -checkend "$((60*60*24*CA_CRT_RENOVATION_DAYS))" -in "${CA_CRT:?}" -noout >/dev/null 2>&1
then
	if [ -n "${CA_RENEW_PREHOOK?}" ]; then
		sh -euc "${CA_RENEW_PREHOOK:?}"
	fi

	printf '%s\n' 'Generating CA certificate...'
	openssl req -new \
		-key "${CA_KEY:?}" \
		-out "${CA_CSR:?}" \
		-subj "${CA_CRT_SUBJ:?}"
	cat > "${CA_CRT_CNF:?}" <<-EOF
		[ x509_exts ]
		subjectKeyIdentifier = hash
		authorityKeyIdentifier = keyid:always,issuer:always
		basicConstraints = critical,CA:TRUE,pathlen:0
		keyUsage = critical,keyCertSign,cRLSign
	EOF
	openssl x509 -req \
		-in "${CA_CSR:?}" \
		-out "${CA_CRT:?}" \
		-signkey "${CA_KEY:?}" \
		-days "${CA_CRT_VALIDITY_DAYS:?}" \
		-sha256 \
		-extfile "${CA_CRT_CNF:?}" \
		-extensions x509_exts
	openssl x509 -in "${CA_CRT:?}" -fingerprint -noout

	if [ -n "${CA_RENEW_POSTHOOK?}" ]; then
		sh -euc "${CA_RENEW_POSTHOOK:?}"
	fi
fi

# Generate server private key if it does not exist
if [ ! -e "${SERVER_KEY:?}" ] \
	|| ! openssl ecparam -check -in "${SERVER_KEY:?}" -noout >/dev/null 2>&1
then
	printf '%s\n' 'Generating server private key...'
	openssl ecparam -genkey -name prime256v1 -out "${SERVER_KEY:?}"
fi

# Generate server certificate if it does not exist or will expire soon
if [ ! -e "${SERVER_CRT:?}" ] \
	|| [ "$(openssl x509 -pubkey -in "${SERVER_CRT:?}" -noout 2>/dev/null)" != "$(openssl pkey -pubout -in "${SERVER_KEY:?}" -outform PEM 2>/dev/null)" ] \
	|| ! openssl verify -CAfile "${CA_CRT:?}" "${SERVER_CRT:?}" >/dev/null 2>&1 \
	|| ! openssl x509 -checkend "$((60*60*24*SERVER_CRT_RENOVATION_DAYS))" -in "${SERVER_CRT:?}" -noout >/dev/null 2>&1
then
	if [ -n "${SERVER_RENEW_PREHOOK?}" ]; then
		sh -euc "${SERVER_RENEW_PREHOOK:?}"
	fi

	printf '%s\n' 'Generating server certificate...'
	openssl req -new \
		-key "${SERVER_KEY:?}" \
		-out "${SERVER_CSR:?}" \
		-subj "${SERVER_CRT_SUBJ:?}"
	cat > "${SERVER_CRT_CNF:?}" <<-EOF
		[ x509_exts ]
		subjectAltName = ${SERVER_CRT_SAN:?}
		basicConstraints = critical,CA:FALSE
		keyUsage = critical,digitalSignature
		extendedKeyUsage = critical,serverAuth
	EOF
	openssl x509 -req \
		-in "${SERVER_CSR:?}" \
		-out "${SERVER_CRT:?}" \
		-CA "${CA_CRT:?}" \
		-CAkey "${CA_KEY:?}" \
		-CAserial "${CA_SRL:?}" -CAcreateserial \
		-days "${SERVER_CRT_VALIDITY_DAYS:?}" \
		-sha256 \
		-extfile "${SERVER_CRT_CNF:?}" \
		-extensions x509_exts
	openssl x509 -in "${SERVER_CRT:?}" -fingerprint -noout

	cat "${CA_CRT:?}" > "${SERVER_CRT_CA:?}"
	cat "${SERVER_CRT:?}" "${SERVER_CRT_CA:?}" > "${SERVER_CRT_FULLCHAIN:?}"

	if [ -n "${SERVER_RENEW_POSTHOOK?}" ]; then
		sh -euc "${SERVER_RENEW_POSTHOOK:?}"
	fi
fi

# Generate client private key if it does not exist
if [ ! -e "${CLIENT_KEY:?}" ] \
	|| ! openssl ecparam -check -in "${CLIENT_KEY:?}" -noout >/dev/null 2>&1
then
	printf '%s\n' 'Generating client private key...'
	openssl ecparam -genkey -name prime256v1 -out "${CLIENT_KEY:?}"
fi

# Generate client certificate if it does not exist or will expire soon
if [ ! -e "${CLIENT_CRT:?}" ] \
	|| [ "$(openssl x509 -pubkey -in "${CLIENT_CRT:?}" -noout 2>/dev/null)" != "$(openssl pkey -pubout -in "${CLIENT_KEY:?}" -outform PEM 2>/dev/null)" ] \
	|| ! openssl verify -CAfile "${CA_CRT:?}" "${CLIENT_CRT:?}" >/dev/null 2>&1 \
	|| ! openssl x509 -checkend "$((60*60*24*CLIENT_CRT_RENOVATION_DAYS))" -in "${CLIENT_CRT:?}" -noout >/dev/null 2>&1
then
	if [ -n "${CLIENT_RENEW_PREHOOK?}" ]; then
		sh -euc "${CLIENT_RENEW_PREHOOK:?}"
	fi

	printf '%s\n' 'Generating client certificate...'
	openssl req -new \
		-key "${CLIENT_KEY:?}" \
		-out "${CLIENT_CSR:?}" \
		-subj "${CLIENT_CRT_SUBJ:?}"
	cat > "${CLIENT_CRT_CNF:?}" <<-EOF
		[ x509_exts ]
		basicConstraints = critical,CA:FALSE
		keyUsage = critical,digitalSignature
		extendedKeyUsage = critical,clientAuth
	EOF
	openssl x509 -req \
		-in "${CLIENT_CSR:?}" \
		-out "${CLIENT_CRT:?}" \
		-CA "${CA_CRT:?}" \
		-CAkey "${CA_KEY:?}" \
		-CAserial "${CA_SRL:?}" -CAcreateserial \
		-days "${CLIENT_CRT_VALIDITY_DAYS:?}" \
		-sha256 \
		-extfile "${CLIENT_CRT_CNF:?}" \
		-extensions x509_exts
	openssl x509 -in "${CLIENT_CRT:?}" -fingerprint -noout

	cat "${CA_CRT:?}" > "${CLIENT_CRT_CA:?}"
	cat "${CLIENT_CRT:?}" "${CLIENT_CRT_CA:?}" > "${CLIENT_CRT_FULLCHAIN:?}"

	openssl pkcs12 -export \
		-inkey "${CLIENT_KEY:?}" \
		-in "${CLIENT_CRT:?}" \
		-out "${CLIENT_P12:?}" \
		-passout "pass:${CLIENT_P12_PASS:?}"

	if [ -n "${CLIENT_RENEW_POSTHOOK?}" ]; then
		sh -euc "${CLIENT_RENEW_POSTHOOK:?}"
	fi
fi
