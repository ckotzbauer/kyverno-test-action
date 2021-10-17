# kyverno-test-action

[![build](https://github.com/ckotzbauer/kyverno-test-action/actions/workflows/main.yml/badge.svg)](https://github.com/ckotzbauer/kyverno-test-action/actions/workflows/main.yml)

> A Github Action to test YAMLs and Helm-Charts against Kyverno policies.

## Usage

```yaml
- uses: azure/setup-helm@v1
- name: Test chart against Kyverno policies
  uses: ckotzbauer/kyverno-test-action@v1
  with:
    chart-dir: charts/my-awesome-helm-chart
    value-files: |
      environments/prod.yaml
    policy-files: |
      policies/best-practices.yaml
      policies/security.yaml
```

## Inputs

| Name | Description | Required | Default |
| --- | --- | --- | --- |
| `token` | `GITHUB_TOKEN` or a `repo` scoped [PAT](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token). | `true` | `GITHUB_TOKEN` |
| `kyverno-version` | Version of the Kyverno-CLI. | `false` | `v1.4.3` |
| `resource-files` | List of Kubernetes-YAML files to test. (Globs are supported) | `false` | `""` |
| `chart-dir` | Helm-Chart directory | `false` | `""` |
| `value-files` | List of Helm-Chart value files. | `false` | `""` |
| `policy-files` | List of Kyverno policy files to apply. (See below) | `true` | `""` |

**Note**: Either `resource-files` or `chart-dir` is mandatory.

## Policy files

The list of policy-files can consist of several types:
- A URL: When a URL is detected, it is downloaded anonymously and treated as `ClusterPolicy`(s).
- A file-path: All files resolved by a optional Glob are treated as `ClusterPolicy`(s).
- *A Kubeconfig-File: Coming soon*

Files with multiple YAML-documents in it are supported (for both `resource-files` and `policy-files`).

Policy-Rules which are related to the `Pod` kind, are automatically auto-generated for the following kinds: 
`DaemonSet`, `Deployment`, `Job`, `StatefulSet` and `CronJob`. (See the [Kyverno docs](https://kyverno.io/docs/writing-policies/autogen/) for details.)
This action adapts this behaviour. Supported are `patterns` and `anyPatterns`. `deny` validations are not auto-generated for other kinds.


## Example 1 (Test always the same helm-chart)

```yaml
jobs:
  kyverno-validate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v2

      - name: Install Helm
        uses: azure/setup-helm@v1

      - name: Test against Kyverno policies
        uses: ckotzbauer/kyverno-test-action@v1
        with:
          chart-dir: charts/my-awesome-helm-chart
          value-files: |
            environments/prod.yaml
          policy-files: |
            policies/best-practices.yaml
            policies/security.yaml
```


## Example 2 (Test dynamic list of helm-charts)

```yaml
jobs:
  list-changed:
    runs-on: ubuntu-latest
    outputs:
      changed: "${{ steps.list-changed.outputs.changed }}"
      charts: "${{ steps.list-changed.outputs.charts }}"
    steps:
      - name: Checkout
        uses: actions/checkout@v2
        with:
          fetch-depth: 0

      - name: Set up chart-testing
        uses: helm/chart-testing-action@v2.1.0

      - name: List changes
        id: list-changed
        run: |
          changed=$(ct list-changed)
          echo "::set-output name=charts::$changed"
          if [[ -n "$changed" ]]; then
            echo "::set-output name=changed::true"
          fi


  kyverno-validate:
    runs-on: ubuntu-latest
    needs: [list-changed]
    if: ${{ needs.list-changed.outputs.changed == 'true' }}
    strategy:
      fail-fast: false
      matrix:
        chart:
        - ${{ needs.list-changed.outputs.charts }}
    steps:
      - name: Checkout
        uses: actions/checkout@v2

      - name: Install Helm
        uses: azure/setup-helm@v1

      - name: Test against Kyverno policies
        uses: ckotzbauer/kyverno-test-action@v1
        with:
          chart-dir: "${{ matrix.chart }}"
          value-files: |
            ${{ matrix.chart }}/values.yaml
          policy-files: |
            policies/best-practices.yaml
            policies/security.yaml
```


## Example 3 (Use policies from Git)

```yaml
jobs:
  kyverno-validate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v2

      - uses: actions/checkout@v2
        name: Checkout kyverno-policies
        with:
          repository: kyverno/policies
          ref: main
          path: kyverno-policies

      - name: Install Helm
        uses: azure/setup-helm@v1

      - name: Test against Kyverno policies
        uses: ckotzbauer/kyverno-test-action@v1
        with:
          chart-dir: charts/my-awesome-helm-chart
          value-files: |
            environments/prod.yaml
          policy-files: |
            kyverno-policies/best-practices/require_probes/require_probes.yaml
            kyverno-policies/best-practices/disallow-empty-ingress-host/disallow_empty_ingress_host.yaml
            kyverno-policies/best-practices/require_drop_all/require_drop_all.yaml
```


## License

[MIT](LICENSE)
